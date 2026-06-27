"""
Layer 5: Behavioral Signal Scoring
Converts Redrob platform signals into a modifier score.
These signals do NOT dominate; they adjust the final score.
A perfect-on-paper candidate who is inactive and unresponsive
is, for practical hiring purposes, unavailable.
"""
from __future__ import annotations
import math
from parsers.candidate_parser import CandidateProfile


def _recency_score(days_since_active: int, cfg: dict) -> float:
    """Scores how recently the candidate was active on the platform."""
    good = cfg.get("recency_good_days", 30)
    stale = cfg.get("recency_stale_days", 90)
    dead = cfg.get("recency_dead_days", 180)

    if days_since_active <= good:
        return 1.0
    if days_since_active <= stale:
        return 0.70 + 0.30 * (1 - (days_since_active - good) / (stale - good))
    if days_since_active <= dead:
        return 0.40 + 0.30 * (1 - (days_since_active - stale) / (dead - stale))
    # Very stale — decays further but never to 0 (they may still be reachable)
    return max(0.10, 0.40 * math.exp(-0.01 * (days_since_active - dead)))


def _notice_period_score(days: int, cfg: dict) -> float:
    """Lower notice = better for startup hiring speed."""
    ideal = cfg.get("notice_ideal_days", 30)
    good = cfg.get("notice_good_days", 60)
    limit = cfg.get("notice_max_penalized_days", 90)

    if days <= ideal:
        return 1.0
    if days <= good:
        return 0.75 + 0.25 * (1 - (days - ideal) / (good - ideal))
    if days <= limit:
        return 0.50 + 0.25 * (1 - (days - good) / (limit - good))
    # > 90 days — steep penalty (JD says "bar gets higher")
    return max(0.20, 0.50 * math.exp(-0.015 * (days - limit)))


def _response_rate_score(rate: float) -> float:
    """Recruiter response rate [0, 1] → score."""
    if rate >= 0.70:
        return 1.0
    if rate >= 0.40:
        return 0.60 + 0.40 * (rate - 0.40) / 0.30
    if rate >= 0.20:
        return 0.30 + 0.30 * (rate - 0.20) / 0.20
    return max(0.05, rate * 1.5)


def _github_score(raw: float) -> float:
    """
    github_activity_score: -1 = no GitHub linked (neutral, not penalised),
    0–100 = activity level.
    """
    if raw < 0:
        return 0.50  # no signal, neutral
    return 0.20 + 0.80 * (raw / 100.0)


def score(cp: CandidateProfile, cfg: dict) -> float:
    """
    Returns behavioral_score ∈ [0, 1].
    Weights are read from cfg['behavioral']['weights'].
    """
    w = cfg.get("behavioral", {}).get("weights", {})
    w_open = w.get("open_to_work", 0.20)
    w_rec = w.get("recency", 0.25)
    w_resp = w.get("response_rate", 0.22)
    w_int = w.get("interview_completion", 0.15)
    w_notice = w.get("notice_period", 0.13)
    w_gh = w.get("github_activity", 0.05)

    b_cfg = cfg.get("behavioral", {})

    open_score = 1.0 if cp.open_to_work else 0.40
    recency = _recency_score(cp.days_since_active, b_cfg)
    resp = _response_rate_score(cp.recruiter_response_rate)
    interview = cp.interview_completion_rate  # already [0, 1]
    notice = _notice_period_score(cp.notice_period_days, b_cfg)
    gh = _github_score(cp.github_activity_score)

    score = (
        w_open * open_score
        + w_rec * recency
        + w_resp * resp
        + w_int * interview
        + w_notice * notice
        + w_gh * gh
    )

    # Small boost for verified identity signals
    if cp.raw.get("redrob_signals", {}).get("verified_email"):
        score = min(1.0, score + 0.01)
    if cp.raw.get("redrob_signals", {}).get("verified_phone"):
        score = min(1.0, score + 0.01)

    return round(min(1.0, max(0.0, score)), 4)
