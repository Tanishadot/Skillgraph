"""
JD Validation Pipeline

Runs the JD Validator before candidate ranking begins.
Returns a corrected HiringProfile ready for use by the ranking engine.

Usage (standalone):
    from pipeline.jd_validation_pipeline import run
    corrected_profile = run(jd_text, initial_profile, print_report=True)

Usage (from rank.py):
    python rank.py --candidates c.jsonl --out sub.csv --jd-text job_description.txt
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional, Union

from agents.job_understanding_agent import HiringProfile
from agents.jd_validator import JDValidator, ValidationResult


def _ascii_safe(text: str) -> str:
    """Replace non-ASCII punctuation with safe ASCII equivalents for Windows consoles."""
    return (
        text
        .replace("—", "--")   # em dash
        .replace("–", "-")    # en dash
        .replace("→", "->")   # arrow
        .replace("─", "-")    # box drawing horizontal
        .replace("—", "--")
    )


def run(
    jd_text: str,
    initial_profile: HiringProfile,
    print_report: bool = True,
    timeline_path: Optional[Path] = None,
    report_file: Optional[Path] = None,
) -> HiringProfile:
    """
    Validate the JD text, print the recruiter feedback report, and return
    the corrected HiringProfile for use in candidate ranking.

    Args:
        jd_text:         Raw job description text.
        initial_profile: Baseline HiringProfile from job_understanding_agent.build().
        print_report:    Whether to print the report to stdout.
        timeline_path:   Override the default technology_timeline.yaml location.
        report_file:     If provided, also write the report to this file.

    Returns:
        A (possibly modified) HiringProfile incorporating corrections.
    """
    kwargs = {"timeline_path": timeline_path} if timeline_path else {}
    validator = JDValidator(**kwargs)
    result: ValidationResult = validator.validate(jd_text, initial_profile)

    if print_report:
        print(_ascii_safe(result.recruiter_report), flush=True)

    if report_file:
        report_file.parent.mkdir(parents=True, exist_ok=True)
        report_file.write_text(_ascii_safe(result.recruiter_report), encoding="utf-8")

    if result.improvements_applied:
        print(
            f"[jd_validator] {len(result.improvements_applied)} correction(s) applied "
            f"to hiring profile. JD quality score: {result.jd_quality_score:.0f}/100",
            file=sys.stderr,
            flush=True,
        )
    else:
        print(
            f"[jd_validator] JD quality score: {result.jd_quality_score:.0f}/100. "
            "No profile corrections needed.",
            file=sys.stderr,
            flush=True,
        )

    return result.corrected_profile


def run_from_file(
    jd_path: Union[str, Path],
    initial_profile: HiringProfile,
    print_report: bool = True,
    report_file: Optional[Path] = None,
) -> HiringProfile:
    """Convenience wrapper: reads JD text from a file then calls run()."""
    path = Path(jd_path)
    if not path.exists():
        raise FileNotFoundError(f"JD text file not found: {path}")
    jd_text = path.read_text(encoding="utf-8", errors="replace")
    return run(jd_text, initial_profile, print_report=print_report, report_file=report_file)
