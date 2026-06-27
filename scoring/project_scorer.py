"""
Layer 3: Project & Experience Analysis
Evaluates the depth and relevance of each candidate's actual work —
not just their listed skills. A candidate who shipped a production
retrieval system at scale outranks one who lists many AI keywords.

Each sub-dimension scores 0–1 independently; they are combined
with configurable weights defined in config/weights.yaml.
"""
from __future__ import annotations
from typing import List, Tuple
from utils.text_utils import normalize, contains_any, count_matches, has_scale_mention
from parsers.candidate_parser import CandidateProfile


# ── Signal vocabularies ────────────────────────────────────────────────────

_PRODUCTION_SIGNALS = [
    "deployed", "in production", "production system", "live system",
    "serving", "model endpoint", "api endpoint", "launched", "shipped",
    "rollout", "a/b test", "a/b testing", "canary", "real users",
    "prod environment", "online serving", "inference pipeline",
    "monitoring", "observability", "alerting",
]

_SCALE_SIGNALS = [
    "million user", "billion", "at scale", "high throughput",
    "low latency", "latency sla", "p99", "p95",
    "qps", "rps", "tps", "requests per second",
    "distributed", "horizontal scaling", "sharding",
    "terabyte", "petabyte", " tb ", " pb ",
    "50k", "100k", "1m ", "10m ",
]

_OWNERSHIP_SIGNALS = [
    "i designed", "i built", "i led", "i architected", "i owned",
    "i drove", "i spearheaded", "i founded", "i created",
    "designed the", "architected the", "built the", "led the",
    "owned the", "drove the", "responsible for", "end-to-end",
    "sole engineer", "founding engineer", "technical lead",
]

_ARCHITECTURE_SIGNALS = [
    "architecture", "system design", "designed the schema",
    "tech stack", "infrastructure", "pipeline design",
    "chose", "selected the", "evaluated tradeoffs",
    "trade-off", "tradeoff", "decided on",
    "schema design", "data model", "api design",
    "microservice", "event-driven", "message queue",
]

_AI_STACK_SIGNALS = [
    # Retrieval & embeddings
    "embedding", "dense retrieval", "sparse retrieval",
    "bm25", "hybrid retrieval", "vector search", "ann",
    "faiss", "pinecone", "weaviate", "qdrant", "milvus",
    "opensearch", "elasticsearch",
    "sentence-transformer", "sentence transformer",
    "retrieval augmented generation", "rag",
    # LLM / fine-tuning
    "fine-tun", "lora", "qlora", "peft", "rlhf",
    "llm", "large language model", "transformer",
    "gpt", "bert", "t5", "mistral", "llama",
    # Evaluation
    "ndcg", "map", "mrr", "ranking evaluation",
    "learning to rank", "lambdarank",
    # ML engineering
    "mlops", "feature store", "model registry",
    "mlflow", "wandb", "weights & biases",
    "model serving", "triton", "torchserve", "bentoml",
    # Core ML
    "pytorch", "tensorflow", "neural network",
    "recommendation system", "search ranking",
    "information retrieval",
]

# Signals that indicate research-only work (slight negative for this role)
_RESEARCH_ONLY_SIGNALS = [
    "published paper", "arxiv", "academic", "research lab",
    "phd research", "dissertation", "university project",
]


# ── Helpers ────────────────────────────────────────────────────────────────

def _score_signals(text: str, signals: List[str], cap: int = 10) -> float:
    """Returns fraction of distinct signal terms found, capped at `cap` unique hits."""
    hits = 0
    for sig in signals:
        if sig in text:
            hits += 1
    return min(hits, cap) / cap


def _per_role_scores(role: dict) -> Tuple[float, float, float, float, float]:
    """
    Returns (production, scale, ownership, architecture, ai_stack) scores
    for a single career history entry.
    """
    desc = normalize(role.get("description", ""))
    title = normalize(role.get("title", ""))
    combined = title + " " + desc

    prod = _score_signals(combined, _PRODUCTION_SIGNALS, cap=6)
    scale = 0.8 if has_scale_mention(combined) else _score_signals(combined, _SCALE_SIGNALS, cap=4)
    own = _score_signals(combined, _OWNERSHIP_SIGNALS, cap=5)
    arch = _score_signals(combined, _ARCHITECTURE_SIGNALS, cap=5)
    ai = _score_signals(combined, _AI_STACK_SIGNALS, cap=8)

    return prod, scale, own, arch, ai


def _duration_weight(months: int) -> float:
    """Longer tenures contribute more to the overall project score."""
    if months >= 36:
        return 1.0
    if months >= 18:
        return 0.80
    if months >= 6:
        return 0.60
    return 0.40


# ── Main scorer ────────────────────────────────────────────────────────────

def score(cp: CandidateProfile, weights: dict) -> Tuple[float, dict]:
    """
    Returns (project_score ∈ [0, 1], breakdown_dict).
    Weights come from config['project']['weights'].
    """
    w = weights.get("project", {}).get("weights", {})
    w_prod = w.get("production_signals", 0.30)
    w_scale = w.get("scale_signals", 0.12)
    w_own = w.get("ownership_signals", 0.22)
    w_arch = w.get("architecture_signals", 0.16)
    w_ai = w.get("ai_stack_signals", 0.20)

    career = cp.raw.get("career_history", [])
    if not career:
        return 0.0, {}

    total_weight = 0.0
    agg_prod = agg_scale = agg_own = agg_arch = agg_ai = 0.0

    for role in career:
        dur_w = _duration_weight(role.get("duration_months", 0))
        prod, scale, own, arch, ai = _per_role_scores(role)

        agg_prod += prod * dur_w
        agg_scale += scale * dur_w
        agg_own += own * dur_w
        agg_arch += arch * dur_w
        agg_ai += ai * dur_w
        total_weight += dur_w

    if total_weight == 0:
        return 0.0, {}

    # Normalise by total weight
    n = total_weight
    d_prod = min(agg_prod / n, 1.0)
    d_scale = min(agg_scale / n, 1.0)
    d_own = min(agg_own / n, 1.0)
    d_arch = min(agg_arch / n, 1.0)
    d_ai = min(agg_ai / n, 1.0)

    # Also scan the combined descriptions for any global AI evidence
    # (guards against AI projects being buried in one short role)
    global_ai = _score_signals(normalize(cp.career_descriptions_combined), _AI_STACK_SIGNALS, cap=12)
    d_ai = max(d_ai, global_ai * 0.8)

    # Penalty if career descriptions are overwhelmingly research-only
    research_hits = count_matches(
        normalize(cp.career_descriptions_combined), _RESEARCH_ONLY_SIGNALS
    )
    research_penalty = min(0.3, research_hits * 0.06)

    composite = (
        w_prod * d_prod
        + w_scale * d_scale
        + w_own * d_own
        + w_arch * d_arch
        + w_ai * d_ai
    )
    composite = max(0.0, composite - research_penalty)

    # Boost if we have confirmed production ML (from candidate parser)
    if cp.has_production_ml:
        composite = min(1.0, composite * 1.15)

    breakdown = {
        "production": round(d_prod, 3),
        "scale": round(d_scale, 3),
        "ownership": round(d_own, 3),
        "architecture": round(d_arch, 3),
        "ai_stack": round(d_ai, 3),
        "research_penalty": round(research_penalty, 3),
        "composite": round(composite, 3),
    }

    return round(composite, 4), breakdown
