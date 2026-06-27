"""
Detects honeypot candidates — profiles with subtly impossible attributes.
The spec says there are ~80 honeypots in 100K (0.08%).
Calibrated against the observed skill distribution:
  - 99.9% of normal candidates have 0 'expert'-level skills
  - Any advanced/expert skill with 0 months used is contradictory
"""
from typing import Tuple, Optional


def check(candidate: dict) -> Tuple[bool, Optional[str]]:
    """Returns (is_honeypot, reason_or_None)."""
    reasons = []
    skills = candidate.get("skills", [])

    # ── Signal 1: Any advanced/expert skill with zero duration ───────────
    # In the synthetic dataset this is a clear impossibility marker
    zero_dur_expert = [
        s.get("name", "?")
        for s in skills
        if s.get("proficiency") in ("expert", "advanced")
        and s.get("duration_months", 1) == 0
    ]
    if zero_dur_expert:
        reasons.append(
            f"advanced/expert skill(s) with 0 months used: "
            + ", ".join(zero_dur_expert[:4])
        )

    # ── Signal 2: ≥8 skills at expert level ─────────────────────────────
    # Observed distribution: normal candidates have 0–5 expert skills;
    # ≥8 is a statistical outlier marker used by the organizers
    expert_count = sum(1 for s in skills if s.get("proficiency") == "expert")
    if expert_count >= 8:
        reasons.append(f"{expert_count} skills listed as 'expert' (≥8 is anomalous)")

    if reasons:
        return True, "; ".join(reasons)
    return False, None
