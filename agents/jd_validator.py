"""
JD Validation Agent — Layer 0 of the hiring pipeline.

Analyses raw job description text BEFORE candidate ranking begins.
Detects impossible experience requirements, contradictions, skill overload,
missing fields, and infers transferable skills.

Returns a ValidationResult containing:
  - All detected issues with explanations
  - A corrected HiringProfile for use by the ranking engine
  - A human-readable recruiter feedback report

All technology knowledge is driven by knowledge/technology_timeline.yaml.
No technology names are hardcoded in validation logic.
"""
from __future__ import annotations

import copy
import re
import textwrap
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

from agents.job_understanding_agent import HiringProfile

_TIMELINE_PATH = Path(__file__).parent.parent / "knowledge" / "technology_timeline.yaml"

# ─── Data model ───────────────────────────────────────────────────────────────

class ExperienceStatus(Enum):
    VALID = "Valid"
    RARE = "Rare"
    IMPLAUSIBLE = "Implausible"
    IMPOSSIBLE = "Impossible"


@dataclass
class ExperienceIssue:
    technology: str            # canonical name from YAML
    requested_years: int
    max_plausible_years: int
    introduced_year: int
    mainstream_year: int
    status: ExperienceStatus
    reasoning: str
    suggested_range: str       # e.g. "2–4 years"


@dataclass
class ContradictionIssue:
    contradiction_type: str    # human-readable label
    signal_a: str              # text fragment that triggered signal A
    signal_b: str              # text fragment that triggered signal B
    explanation: str
    suggestion: str


@dataclass
class SkillOverloadReport:
    total_skills: int
    by_category: Dict[str, List[str]]  # category → [tech names]
    complexity_score: float            # 0–10
    talent_availability: str           # "high" | "medium" | "low" | "critical"
    recommendation: str
    priority_skills: List[str]         # distilled must-haves
    optional_skills: List[str]         # suggested nice-to-haves


@dataclass
class MissingRequirement:
    field_name: str
    importance: str    # "critical" | "recommended" | "optional"
    suggestion: str


@dataclass
class TransferableMapping:
    canonical_skill: str       # skill explicitly in JD
    competency: str            # inferred competency label
    equivalents: List[str]     # other technologies proving the same competency


@dataclass
class ValidationResult:
    jd_quality_score: float          # 0–100 (higher = better written JD)
    experience_issues: List[ExperienceIssue]
    contradictions: List[ContradictionIssue]
    skill_overload: Optional[SkillOverloadReport]
    missing_requirements: List[MissingRequirement]
    transferable_mappings: List[TransferableMapping]
    corrected_profile: HiringProfile
    recruiter_report: str            # formatted text for display
    improvements_applied: List[str]  # one-line summaries of changes made


# ─── Contradiction rule definitions ───────────────────────────────────────────
# Each rule is data; the validator loops over these and matches against JD text.

_CONTRADICTION_RULES = [
    {
        "id": "junior_high_experience",
        "type": "Seniority vs Experience Requirement",
        "pattern_a": r"\b(junior|entry[- ]?level|fresher|new graduate|intern|graduate engineer)\b",
        "pattern_b": r"\b([5-9]|\d{2})\+?\s*years?\s+(?:of\s+)?(?:experience|exp)\b",
        "explanation": (
            "'{a}' seniority language is paired with '{b}' of required experience. "
            "Engineers with 5+ years are universally considered mid-to-senior level, "
            "so this combination will confuse qualified applicants and deter them from applying."
        ),
        "suggestion": (
            "Use 'Mid-Level' or 'Senior' in the title, or reduce the experience floor "
            "to 0–2 years if the role is genuinely entry-level."
        ),
    },
    {
        "id": "remote_relocation",
        "type": "Remote Policy vs Relocation Requirement",
        "pattern_a": r"\b(fully[- ]remote|remote[- ]only|100\s*%\s*remote|work from anywhere|location[- ]agnostic)\b",
        "pattern_b": r"\b(relocation required|must relocate|willing to relocate|relocation assistance provided)\b",
        "explanation": (
            "'{a}' and '{b}' are mutually exclusive: a fully-remote role cannot require physical relocation."
        ),
        "suggestion": (
            "Remove either the remote policy or the relocation requirement. "
            "If the role is hybrid, state the expected in-office days explicitly."
        ),
    },
    {
        "id": "immediate_long_notice",
        "type": "Immediate Joining vs Long Notice Period",
        "pattern_a": r"\b(immediate\s+join(?:er|ing)?|start\s+immediately|notice\s+period\s*[:\-]?\s*(?:0|nil|none|zero)|no\s+notice)\b",
        "pattern_b": r"\b(notice\s+period\s*[:\-]?\s*(?:60|90|120)\s*days?|(?:3|4)\s*months?\s*notice|90[- ]day\s*notice)\b",
        "explanation": (
            "'{a}' conflicts with an acceptable notice period of '{b}'. "
            "Requiring immediate joining effectively disqualifies employed candidates with standard notice periods."
        ),
        "suggestion": (
            "Specify a realistic notice window (e.g. 'up to 30 days preferred, 60 days acceptable'), "
            "or remove the immediate-joining requirement."
        ),
    },
    {
        "id": "researcher_sales",
        "type": "Research Role vs Sales Responsibilities",
        "pattern_a": r"\b(ai\s*researcher?|research\s+scientist|r\s*&\s*d|basic\s+research|research\s+lab)\b",
        "pattern_b": r"\b(sales\s+target|revenue\s+target|business\s+development|client\s+acquisition|quota|cold\s+call)\b",
        "explanation": (
            "'{a}' attracts a completely different talent pool than '{b}'. "
            "Mixing them produces a JD that no candidate fits well."
        ),
        "suggestion": (
            "Split into separate Research Scientist and Business Development roles, "
            "or reframe as 'Applied AI Engineer' if production impact is the goal."
        ),
    },
    {
        "id": "junior_leadership",
        "type": "Junior Title vs Leadership Responsibilities",
        "pattern_a": r"\b(junior|entry[- ]?level|associate\s+engineer)\b",
        "pattern_b": r"\b(lead(?:ing)?\s+(?:a\s+)?team|manage\s+engineers?|head\s+of|director|vp\s+of|principal\s+engineer|architect)\b",
        "explanation": (
            "'{a}' implies low seniority, but '{b}' describes a leadership responsibility "
            "that would typically require a Staff or Principal-level hire."
        ),
        "suggestion": (
            "Adjust the title to Senior/Staff/Lead, or remove the team-lead expectation "
            "if this is truly an individual-contributor role."
        ),
    },
    {
        "id": "ic_large_team",
        "type": "Individual Contributor vs Managing Multiple Teams",
        "pattern_a": r"\b(individual\s+contributor|ic\s+role|no\s+direct\s+reports)\b",
        "pattern_b": r"\b(manag(?:e|ing)\s+(?:\d+\s+)?teams?|oversee\s+(?:\d+\s+)?engineers?|reporting\s+to\s+you\s*:\s*\d+)\b",
        "explanation": (
            "'{a}' and '{b}' conflict: a no-direct-reports IC role cannot manage teams."
        ),
        "suggestion": (
            "Clarify whether the role has people-management scope. "
            "If yes, update to 'Engineering Manager' or 'Tech Lead' and remove 'IC' language."
        ),
    },
    {
        "id": "part_time_full_ownership",
        "type": "Part-Time Engagement vs Full System Ownership",
        "pattern_a": r"\b(part[- ]time|fractional|contract\s+\d+\s*hrs?|hourly\s+contract)\b",
        "pattern_b": r"\b(full\s+ownership|own\s+the\s+(?:system|platform|product)|end[- ]to[- ]end\s+ownership|single\s+point\s+of\s+contact)\b",
        "explanation": (
            "'{a}' engagement cannot reasonably deliver '{b}'. "
            "End-to-end ownership implies sustained full-time availability."
        ),
        "suggestion": (
            "Convert to a full-time or long-term contract engagement, "
            "or scope ownership more narrowly ('own the retrieval component')."
        ),
    },
]

# ─── Missing-requirement checks ───────────────────────────────────────────────

_MISSING_CHECKS = [
    {
        "field": "Years of experience",
        "importance": "critical",
        "probe": r"\b\d+\+?\s*years?\b",
        "suggestion": "Add a concrete experience range (e.g. '4–8 years of experience in applied ML/AI').",
    },
    {
        "field": "Seniority level",
        "importance": "critical",
        "probe": r"\b(junior|mid[- ]?level|senior|staff|principal|lead|director)\b",
        "suggestion": "State the seniority level explicitly in the title or first paragraph.",
    },
    {
        "field": "Location / remote policy",
        "importance": "critical",
        "probe": r"\b(remote|on[- ]?site|hybrid|location|based\s+in|city|country)\b",
        "suggestion": "Specify location preference and remote/hybrid/onsite policy.",
    },
    {
        "field": "Employment type",
        "importance": "recommended",
        "probe": r"\b(full[- ]?time|part[- ]?time|contract|permanent|temporary|freelance)\b",
        "suggestion": "State employment type: full-time permanent, contract, etc.",
    },
    {
        "field": "Responsibilities section",
        "importance": "critical",
        "probe": r"\b(responsibilit|you\s+will|role\s+involves?|duties|accountab)\b",
        "suggestion": "Add a 'What you'll do' section with 4–6 concrete bullet points.",
    },
    {
        "field": "Preferred qualifications",
        "importance": "recommended",
        "probe": r"\b(preferred|nice[- ]to[- ]have|bonus|plus|advantageous|desired)\b",
        "suggestion": "Add a 'Nice to have' section to distinguish must-haves from bonuses.",
    },
    {
        "field": "Success metrics",
        "importance": "recommended",
        "probe": r"\b(metric|kpi|okr|success\s+criteria|measure|benchmark|target)\b",
        "suggestion": (
            "Define what success looks like in 30/60/90 days "
            "to attract candidates who are results-oriented."
        ),
    },
    {
        "field": "Notice period expectation",
        "importance": "optional",
        "probe": r"\b(notice\s+period|joining\s+date|start\s+date|available)\b",
        "suggestion": "State acceptable notice periods so candidates can self-qualify.",
    },
]


# ─── Main validator class ──────────────────────────────────────────────────────

class JDValidator:
    """
    Validates a raw job description text against the technology knowledge base
    and a set of heuristic contradiction / quality rules.

    Usage:
        validator = JDValidator()
        result = validator.validate(jd_text, initial_hiring_profile)
        print(result.recruiter_report)
    """

    def __init__(self, timeline_path: Path = _TIMELINE_PATH):
        self._timeline: Dict = self._load_timeline(timeline_path)
        self._alias_map: Dict[str, str] = self._build_alias_map()
        self._current_year: int = datetime.now().year

    # ── Initialisation helpers ─────────────────────────────────────────────────

    def _load_timeline(self, path: Path) -> Dict:
        if not path.exists():
            raise FileNotFoundError(f"Technology timeline not found: {path}")
        with open(path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def _build_alias_map(self) -> Dict[str, str]:
        """alias (lowercase) → canonical key in _timeline"""
        alias_map: Dict[str, str] = {}
        for key, info in self._timeline.items():
            alias_map[key.lower().replace("_", " ")] = key
            alias_map[key.lower()] = key
            for alias in info.get("aliases", []):
                alias_map[alias.lower()] = key
        return alias_map

    def _resolve_tech(self, text: str) -> Optional[str]:
        """Try to match a text fragment to a canonical technology key."""
        text_clean = text.lower().strip().rstrip("s,;:.)")
        if text_clean in self._alias_map:
            return self._alias_map[text_clean]
        # Allow partial-word boundaries for multi-word aliases
        for alias, canonical in self._alias_map.items():
            if re.search(r"\b" + re.escape(alias) + r"\b", text_clean):
                return canonical
        return None

    def _max_plausible_years(self, tech_key: str) -> int:
        info = self._timeline[tech_key]
        mainstream = info.get("mainstream", info.get("introduced", self._current_year))
        return max(1, self._current_year - mainstream + 1)

    def _classify_experience(self, years: int, max_plausible: int) -> ExperienceStatus:
        if years > max_plausible + 3:
            return ExperienceStatus.IMPOSSIBLE
        if years > max_plausible + 1:
            return ExperienceStatus.IMPLAUSIBLE
        if years >= max_plausible:
            return ExperienceStatus.RARE
        return ExperienceStatus.VALID

    # ── Check 1: Impossible experience requirements ────────────────────────────

    def check_experience_requirements(self, jd_text: str) -> List[ExperienceIssue]:
        """
        Extract 'X years of <technology>' patterns from the JD and flag any
        that are impossible or implausible given the technology's actual age.
        """
        issues: List[ExperienceIssue] = []
        seen: set = set()

        # Multiple extraction patterns to catch different phrasings
        patterns = [
            # "8+ years of RAG" / "8 years RAG experience"
            r"(\d+)\+?\s*years?\s+(?:of\s+)?(?:hands[- ]on\s+)?(?:experience\s+(?:in|with|of|using)\s+)?([A-Za-z][A-Za-z0-9\-\+\. ]{1,40}?)(?:\s+experience)?(?=[,;\.\n\(]|$)",
            # "RAG: 8+ years" / "RAG — 8 years"
            r"([A-Za-z][A-Za-z0-9\-\+\. ]{1,40}?)\s*[:\-–]+\s*(\d+)\+?\s*years?",
            # "minimum 8 years of RAG"
            r"(?:minimum|min|at\s+least)\s+(?:of\s+)?(\d+)\s+years?\s+(?:of\s+)?([A-Za-z][A-Za-z0-9\-\+\. ]{1,40})",
        ]

        for pat_idx, pat in enumerate(patterns):
            for match in re.finditer(pat, jd_text, re.IGNORECASE | re.MULTILINE):
                g = match.groups()
                if pat_idx == 1:
                    # second pattern: tech is first group, years is second
                    tech_text, years_str = g[0].strip(), g[1].strip()
                else:
                    years_str, tech_text = g[0].strip(), g[1].strip()

                if not years_str.isdigit():
                    continue
                years = int(years_str)
                if years < 1 or years > 30:
                    continue

                canonical = self._resolve_tech(tech_text)
                if canonical is None or canonical in seen:
                    continue
                seen.add(canonical)

                max_p = self._max_plausible_years(canonical)
                status = self._classify_experience(years, max_p)

                if status == ExperienceStatus.VALID:
                    continue   # only report issues

                info = self._timeline[canonical]
                mainstream_year = info.get("mainstream", info.get("introduced", self._current_year))
                introduced_year = info.get("introduced", mainstream_year)
                notes = info.get("notes", "")

                reasoning = self._build_experience_reasoning(
                    canonical, years, max_p, mainstream_year, introduced_year, status, notes
                )
                suggested_min = max(1, max_p - 2)
                suggested_max = max_p

                issues.append(ExperienceIssue(
                    technology=canonical,
                    requested_years=years,
                    max_plausible_years=max_p,
                    introduced_year=introduced_year,
                    mainstream_year=mainstream_year,
                    status=status,
                    reasoning=reasoning,
                    suggested_range=f"{suggested_min}–{suggested_max} years",
                ))

        return issues

    def _build_experience_reasoning(
        self,
        tech: str,
        requested: int,
        max_p: int,
        mainstream_year: int,
        introduced_year: int,
        status: ExperienceStatus,
        notes: str,
    ) -> str:
        age = self._current_year - mainstream_year + 1
        lines = [
            f"'{tech}' became widely adopted around {mainstream_year} "
            f"(introduced {introduced_year}).",
            f"As of {self._current_year}, the maximum realistic experience is "
            f"~{max_p} year{'s' if max_p != 1 else ''} even for early adopters.",
        ]
        if notes:
            lines.append(notes)
        if status == ExperienceStatus.IMPOSSIBLE:
            lines.append(
                f"Requesting {requested} years is impossible — the technology is only "
                f"~{age} year{'s' if age != 1 else ''} old in mainstream use."
            )
        elif status == ExperienceStatus.IMPLAUSIBLE:
            lines.append(
                f"Requesting {requested} years is implausible — only a handful of "
                f"researchers who worked on the technology before public release would qualify."
            )
        elif status == ExperienceStatus.RARE:
            lines.append(
                f"Requesting {requested} years is technically possible but rare — "
                f"this will filter out many otherwise qualified candidates."
            )
        return " ".join(lines)

    # ── Check 2: Contradictions ────────────────────────────────────────────────

    def check_contradictions(self, jd_text: str) -> List[ContradictionIssue]:
        """Scan the JD for pairs of signals that contradict each other."""
        issues: List[ContradictionIssue] = []
        text_lower = jd_text.lower()

        for rule in _CONTRADICTION_RULES:
            m_a = re.search(rule["pattern_a"], text_lower)
            m_b = re.search(rule["pattern_b"], text_lower)
            if m_a and m_b:
                signal_a = jd_text[m_a.start():m_a.end()].strip()
                signal_b = jd_text[m_b.start():m_b.end()].strip()
                explanation = rule["explanation"].format(a=signal_a, b=signal_b)
                issues.append(ContradictionIssue(
                    contradiction_type=rule["type"],
                    signal_a=signal_a,
                    signal_b=signal_b,
                    explanation=explanation,
                    suggestion=rule["suggestion"],
                ))

        return issues

    # ── Check 3: Skill overload ────────────────────────────────────────────────

    def check_skill_overload(self, jd_text: str) -> Optional[SkillOverloadReport]:
        """
        Scan the JD for all mentioned technologies, group by category, and
        flag if the combination is unrealistically broad.
        """
        found_by_category: Dict[str, List[str]] = {}
        text_lower = jd_text.lower()
        seen_canonical: set = set()

        for alias, canonical in self._alias_map.items():
            if canonical in seen_canonical:
                continue
            # Require whole-word match to avoid false positives (e.g. "go" in "good")
            if len(alias) <= 2:
                pattern = r"(?<![a-z])" + re.escape(alias) + r"(?![a-z])"
            else:
                pattern = r"\b" + re.escape(alias) + r"\b"

            if re.search(pattern, text_lower):
                info = self._timeline[canonical]
                category = info.get("category", "other")
                found_by_category.setdefault(category, [])
                found_by_category[category].append(canonical)
                seen_canonical.add(canonical)

        total = sum(len(v) for v in found_by_category.values())
        n_cats = len(found_by_category)

        if total <= 8 and n_cats <= 3:
            return None   # normal; no overload

        # Compute complexity score (0–10)
        complexity = min(10.0, round((total / 20.0) * 10, 1))

        if total > 20 or n_cats > 6:
            availability = "critical"
            recommendation = (
                f"This JD mentions {total} distinct technologies across {n_cats} categories — "
                "a combination that virtually no single candidate will possess. "
                "Strong recommendation: split into 2–3 focused roles "
                "(e.g. ML Platform Engineer, Applied AI Engineer, Backend Engineer)."
            )
        elif total > 14 or n_cats > 4:
            availability = "low"
            recommendation = (
                f"{total} technologies across {n_cats} categories is ambitious. "
                "Prioritise the 6–8 most important skills as hard requirements; "
                "move the rest to 'nice to have'."
            )
        else:
            availability = "medium"
            recommendation = (
                f"{total} technologies is elevated. "
                "Consider marking 2–3 categories as optional to widen the talent pool."
            )

        # Heuristic: largest categories → priority skills; smallest → optional
        sorted_cats = sorted(found_by_category.items(), key=lambda x: -len(x[1]))
        priority: List[str] = []
        optional: List[str] = []
        for cat, techs in sorted_cats:
            if len(priority) < 8:
                priority.extend(techs[:2])
            else:
                optional.extend(techs[:2])

        return SkillOverloadReport(
            total_skills=total,
            by_category=found_by_category,
            complexity_score=complexity,
            talent_availability=availability,
            recommendation=recommendation,
            priority_skills=priority[:8],
            optional_skills=optional[:8],
        )

    # ── Check 4: Missing requirements ─────────────────────────────────────────

    def check_missing_requirements(self, jd_text: str) -> List[MissingRequirement]:
        """Flag important fields absent from the JD."""
        issues: List[MissingRequirement] = []
        text_lower = jd_text.lower()

        for check in _MISSING_CHECKS:
            if not re.search(check["probe"], text_lower, re.IGNORECASE):
                issues.append(MissingRequirement(
                    field_name=check["field"],
                    importance=check["importance"],
                    suggestion=check["suggestion"],
                ))

        return issues

    # ── Check 5: Transferable skills ──────────────────────────────────────────

    def map_transferable_skills(self, jd_text: str) -> List[TransferableMapping]:
        """
        For each technology found in the JD, identify all technologies in the
        same category that prove the same underlying competency.
        These become alternative-accepted skills in the corrected profile.
        """
        text_lower = jd_text.lower()
        seen_canonical: set = set()
        category_members: Dict[str, List[str]] = {}

        # Build per-category tech lists from the full timeline
        for canonical, info in self._timeline.items():
            cat = info.get("category", "other")
            category_members.setdefault(cat, [])
            category_members[cat].append(canonical)

        # Competency label per category (human-readable)
        competency_labels = {
            "vector_db": "Vector Database / ANN Search",
            "embeddings": "Text Embedding Models",
            "retrieval": "Information Retrieval",
            "llm_orchestration": "LLM Orchestration Framework",
            "llm_framework": "LLM Application Framework",
            "fine_tuning": "LLM Fine-Tuning",
            "ml_framework": "ML / Deep Learning Framework",
            "mlops": "ML Experiment Tracking & MLOps",
            "ml_serving": "Model Serving & Inference",
            "llm_serving": "LLM Inference Serving",
            "cloud": "Cloud Platform",
            "cloud_ml": "Managed ML Cloud Service",
            "devops": "Containerisation & Orchestration",
            "language": "Programming Language",
            "web_framework": "Production Web / API Framework",
            "database": "Relational / NoSQL Database",
            "data_warehouse": "Data Warehouse",
            "data_processing": "Distributed Data Processing",
            "streaming": "Event Streaming",
            "search": "Full-Text Search Engine",
            "ranking": "Learning to Rank",
            "language_model": "Pre-trained Language Model",
            "llm": "Large Language Model API",
            "gpu_computing": "GPU / Accelerated Computing",
            "llm_safety": "LLM Safety & Guardrails",
            "llm_observability": "LLM Observability & Tracing",
        }

        mappings: List[TransferableMapping] = []

        for alias, canonical in self._alias_map.items():
            if canonical in seen_canonical:
                continue
            if len(alias) <= 2:
                pattern = r"(?<![a-z])" + re.escape(alias) + r"(?![a-z])"
            else:
                pattern = r"\b" + re.escape(alias) + r"\b"

            if re.search(pattern, text_lower):
                seen_canonical.add(canonical)
                cat = self._timeline[canonical].get("category", "other")
                peers = [t for t in category_members.get(cat, []) if t != canonical]
                if not peers:
                    continue
                competency = competency_labels.get(cat, cat.replace("_", " ").title())
                mappings.append(TransferableMapping(
                    canonical_skill=canonical,
                    competency=competency,
                    equivalents=peers[:6],  # cap at 6 alternatives
                ))

        return mappings

    # ── Check 6+7: Corrected profile + score ──────────────────────────────────

    def _build_corrected_profile(
        self,
        initial: HiringProfile,
        experience_issues: List[ExperienceIssue],
        transferable_mappings: List[TransferableMapping],
        missing: List[MissingRequirement],
    ) -> Tuple[HiringProfile, List[str]]:
        """
        Produce a modified HiringProfile that incorporates validator findings.
        Returns (corrected_profile, list_of_improvement_descriptions).
        """
        profile = copy.deepcopy(initial)
        improvements: List[str] = []

        # 1. Expand must_have_skill_categories with transferable equivalents
        existing_terms: set = set()
        for terms in profile.must_have_skill_categories.values():
            existing_terms.update(t.lower() for t in terms)

        for mapping in transferable_mappings:
            # Find which category the canonical skill lives in
            target_cat = None
            for cat, terms in profile.must_have_skill_categories.items():
                if any(mapping.canonical_skill.lower() in t.lower() or
                       t.lower() in mapping.canonical_skill.lower()
                       for t in terms):
                    target_cat = cat
                    break

            new_terms: List[str] = []
            for equiv in mapping.equivalents:
                info = self._timeline.get(equiv, {})
                # Add canonical name
                if equiv.lower() not in existing_terms:
                    new_terms.append(equiv)
                    existing_terms.add(equiv.lower())
                # Add first alias if distinct
                for alias in info.get("aliases", [])[:1]:
                    if alias.lower() not in existing_terms:
                        new_terms.append(alias)
                        existing_terms.add(alias.lower())

            if new_terms and target_cat:
                profile.must_have_skill_categories[target_cat].extend(new_terms)
                improvements.append(
                    f"Expanded '{target_cat}' skill category with transferable equivalents: "
                    f"{', '.join(new_terms[:4])}{'...' if len(new_terms) > 4 else ''}"
                )
            elif new_terms:
                # Add to nice_to_have if no matching category
                profile.nice_to_have_skills.extend(new_terms)
                improvements.append(
                    f"Added transferable '{mapping.competency}' alternatives to nice-to-have list."
                )

        # 2. Adjust JD query texts to surface corrected terminology
        impossible_techs = [
            i.technology for i in experience_issues
            if i.status in (ExperienceStatus.IMPOSSIBLE, ExperienceStatus.IMPLAUSIBLE)
        ]
        if impossible_techs:
            profile.jd_query_texts.append(
                "early adopter cutting-edge AI systems RAG vector search senior engineer "
                + " ".join(impossible_techs[:4])
            )
            improvements.append(
                f"Added corrected semantic query for implausible-experience technologies: "
                f"{', '.join(impossible_techs[:4])}"
            )

        # 3. Extend nice_to_have for missing recommended fields
        for m in missing:
            if m.importance == "critical":
                improvements.append(
                    f"Note: JD is missing '{m.field_name}' — recruiter should add this before publishing."
                )

        return profile, improvements

    def _compute_quality_score(
        self,
        experience_issues: List[ExperienceIssue],
        contradictions: List[ContradictionIssue],
        skill_overload: Optional[SkillOverloadReport],
        missing: List[MissingRequirement],
    ) -> float:
        score = 100.0
        for issue in experience_issues:
            if issue.status == ExperienceStatus.IMPOSSIBLE:
                score -= 12
            elif issue.status == ExperienceStatus.IMPLAUSIBLE:
                score -= 7
            elif issue.status == ExperienceStatus.RARE:
                score -= 3
        for _ in contradictions:
            score -= 10
        if skill_overload:
            if skill_overload.talent_availability == "critical":
                score -= 15
            elif skill_overload.talent_availability == "low":
                score -= 8
            else:
                score -= 4
        for m in missing:
            if m.importance == "critical":
                score -= 5
            elif m.importance == "recommended":
                score -= 2
        return max(0.0, round(score, 1))

    # ── Public entry point ─────────────────────────────────────────────────────

    def validate(self, jd_text: str, initial_profile: HiringProfile) -> ValidationResult:
        """
        Run all validation checks and return a ValidationResult.
        The corrected_profile in the result should be used for candidate ranking.
        """
        exp_issues = self.check_experience_requirements(jd_text)
        contradictions = self.check_contradictions(jd_text)
        skill_overload = self.check_skill_overload(jd_text)
        missing = self.check_missing_requirements(jd_text)
        transferable = self.map_transferable_skills(jd_text)

        quality = self._compute_quality_score(exp_issues, contradictions, skill_overload, missing)
        corrected, improvements = self._build_corrected_profile(
            initial_profile, exp_issues, transferable, missing
        )

        report = self._generate_report(
            quality, exp_issues, contradictions, skill_overload, missing, transferable,
            improvements, initial_profile
        )

        return ValidationResult(
            jd_quality_score=quality,
            experience_issues=exp_issues,
            contradictions=contradictions,
            skill_overload=skill_overload,
            missing_requirements=missing,
            transferable_mappings=transferable,
            corrected_profile=corrected,
            recruiter_report=report,
            improvements_applied=improvements,
        )

    # ── Report generation ─────────────────────────────────────────────────────

    def _generate_report(
        self,
        quality: float,
        exp_issues: List[ExperienceIssue],
        contradictions: List[ContradictionIssue],
        skill_overload: Optional[SkillOverloadReport],
        missing: List[MissingRequirement],
        transferable: List[TransferableMapping],
        improvements: List[str],
        initial_profile: HiringProfile,
    ) -> str:
        lines: List[str] = []
        sep = "=" * 70
        thin = "-" * 70

        # Header
        lines += [
            sep,
            "  JD VALIDATOR - RECRUITER FEEDBACK REPORT",
            sep,
            f"  Role    : {initial_profile.role}",
            f"  Company : {initial_profile.company}",
            f"  JD Quality Score: {quality:.0f}/100",
            "",
        ]

        # Quality interpretation
        if quality >= 85:
            lines.append("  OVERALL: Well-written JD. Minor improvements suggested.")
        elif quality >= 65:
            lines.append("  OVERALL: Acceptable JD with several issues that may reduce applicant quality.")
        elif quality >= 40:
            lines.append("  OVERALL: JD has significant problems. Recommend revising before publishing.")
        else:
            lines.append("  OVERALL: JD has critical issues. Publishing as-is will likely attract poor-fit applicants.")
        lines.append("")

        # Section 1: Experience issues
        lines.append(thin)
        lines.append("  1. EXPERIENCE REQUIREMENT ANALYSIS")
        lines.append(thin)
        if not exp_issues:
            lines.append("  No impossible or implausible experience requirements detected.")
        else:
            for issue in sorted(exp_issues, key=lambda x: (
                0 if x.status == ExperienceStatus.IMPOSSIBLE else
                1 if x.status == ExperienceStatus.IMPLAUSIBLE else 2
            )):
                lines += [
                    f"  [{issue.status.value.upper()}] {issue.technology}",
                    f"    Requested : {issue.requested_years} years",
                    f"    Max plausible : {issue.max_plausible_years} years "
                    f"(mainstream since {issue.mainstream_year})",
                    f"    Suggested : {issue.suggested_range}",
                    f"    Why : " + textwrap.fill(
                        issue.reasoning, width=60,
                        initial_indent="", subsequent_indent="          "
                    ),
                    "",
                ]
        lines.append("")

        # Section 2: Contradictions
        lines.append(thin)
        lines.append("  2. CONTRADICTIONS")
        lines.append(thin)
        if not contradictions:
            lines.append("  No contradictions detected.")
        else:
            for c in contradictions:
                lines += [
                    f"  [{c.contradiction_type}]",
                    f"    Signal A : \"{c.signal_a}\"",
                    f"    Signal B : \"{c.signal_b}\"",
                    "    Problem  : " + textwrap.fill(
                        c.explanation, width=60,
                        initial_indent="", subsequent_indent="             "
                    ),
                    "    Fix      : " + textwrap.fill(
                        c.suggestion, width=60,
                        initial_indent="", subsequent_indent="             "
                    ),
                    "",
                ]
        lines.append("")

        # Section 3: Skill overload
        lines.append(thin)
        lines.append("  3. SKILL COMPLEXITY ANALYSIS")
        lines.append(thin)
        if skill_overload is None:
            lines.append("  Skill set is reasonable in breadth.")
        else:
            lines += [
                f"  Total technologies mentioned : {skill_overload.total_skills}",
                f"  Categories spanned          : {len(skill_overload.by_category)}",
                f"  Complexity score            : {skill_overload.complexity_score}/10",
                f"  Estimated talent pool       : {skill_overload.talent_availability.upper()}",
                "",
                "  By category:",
            ]
            for cat, techs in sorted(skill_overload.by_category.items()):
                lines.append(f"    {cat:30s}: {', '.join(techs)}")
            lines += [
                "",
                "  Recommendation:",
                "    " + textwrap.fill(skill_overload.recommendation, width=66,
                                        subsequent_indent="    "),
                "",
                f"  Priority skills   : {', '.join(skill_overload.priority_skills)}",
                f"  Optional skills   : {', '.join(skill_overload.optional_skills)}",
            ]
        lines.append("")

        # Section 4: Missing requirements
        lines.append(thin)
        lines.append("  4. MISSING INFORMATION")
        lines.append(thin)
        if not missing:
            lines.append("  JD appears complete.")
        else:
            for m in sorted(missing, key=lambda x: {"critical": 0, "recommended": 1, "optional": 2}[x.importance]):
                lines += [
                    f"  [{m.importance.upper()}] {m.field_name}",
                    "    Suggestion: " + textwrap.fill(
                        m.suggestion, width=56,
                        initial_indent="", subsequent_indent="               "
                    ),
                    "",
                ]
        lines.append("")

        # Section 5: Transferable skills
        lines.append(thin)
        lines.append("  5. TRANSFERABLE SKILLS — ACCEPTED EQUIVALENTS")
        lines.append(thin)
        if not transferable:
            lines.append("  No transferable skill mappings identified.")
        else:
            lines.append(
                "  The following technologies were detected in the JD. "
                "Candidates with the listed\n"
                "  equivalents should be considered equally qualified for that competency:"
            )
            lines.append("")
            for m in transferable[:12]:
                lines += [
                    f"  {m.canonical_skill}",
                    f"    Competency   : {m.competency}",
                    f"    Also accept  : {', '.join(m.equivalents[:5])}",
                    "",
                ]
        lines.append("")

        # Section 6: Improvements applied to hiring profile
        lines.append(thin)
        lines.append("  6. CORRECTIONS APPLIED TO HIRING PROFILE")
        lines.append(thin)
        if not improvements:
            lines.append("  No corrections needed — hiring profile used as-is.")
        else:
            for imp in improvements:
                lines.append("  + " + textwrap.fill(imp, width=67, subsequent_indent="    "))
        lines.append("")
        lines.append(sep)

        return "\n".join(lines)
