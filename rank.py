#!/usr/bin/env python3
"""
Redrob Hackathon — Intelligent Candidate Discovery & Ranking

Usage (standard):
    python rank.py --candidates ./candidates.jsonl --out ./submission.csv

Usage (with custom JD text + validation report):
    python rank.py --candidates ./candidates.jsonl --out ./submission.csv \
                   --jd-text ./job_description.txt --jd-report ./jd_report.txt

Usage (skip JD validation):
    python rank.py --candidates ./candidates.jsonl --out ./submission.csv --no-validate-jd

Usage (with pre-computed embeddings):
    python rank.py --candidates ./candidates.jsonl --out ./submission.csv \
                   --embeddings ./candidate_embeddings.npy \
                   --embedding-ids ./candidate_ids.json

Usage (with LLM explanations — requires ANTHROPIC_API_KEY env var):
    python rank.py --candidates ./candidates.jsonl --out ./submission.csv --use-llm

Validate output:
    python validate_submission.py submission.csv
"""
import argparse
import sys
import time
from pathlib import Path
from typing import Optional

# Make project root importable regardless of working directory
sys.path.insert(0, str(Path(__file__).parent))

from pipeline import ranker


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Rank 100K candidates against the Redrob Senior AI Engineer JD."
    )
    p.add_argument(
        "--candidates",
        required=True,
        type=Path,
        help="Path to candidates.jsonl (or .jsonl.gz — gunzip first).",
    )
    p.add_argument(
        "--out",
        required=True,
        type=Path,
        help="Output CSV path, e.g. ./submission.csv",
    )
    p.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parent / "config" / "weights.yaml",
        help="Path to weights.yaml (default: config/weights.yaml).",
    )
    p.add_argument(
        "--embeddings",
        type=Path,
        default=None,
        help="Pre-computed candidate embeddings .npy file (optional).",
    )
    p.add_argument(
        "--embedding-ids",
        type=Path,
        default=None,
        help="Pre-computed candidate IDs .json file (optional, pairs with --embeddings).",
    )
    p.add_argument(
        "--use-llm",
        action="store_true",
        help="Use Claude API for explanation generation (requires ANTHROPIC_API_KEY).",
    )
    p.add_argument(
        "--top-n",
        type=int,
        default=100,
        help="Number of candidates to rank (default: 100).",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress output.",
    )
    p.add_argument(
        "--jd-text",
        type=Path,
        default=None,
        help=(
            "Path to a plain-text job description file. "
            "The JD Validator will analyse it and produce a corrected hiring profile. "
            "If omitted, the built-in JD text from job_understanding_agent.py is used."
        ),
    )
    p.add_argument(
        "--no-validate-jd",
        action="store_true",
        help="Skip JD validation and use the raw hiring profile as-is.",
    )
    p.add_argument(
        "--jd-report",
        type=Path,
        default=None,
        help="Write the JD validation recruiter report to this file (optional).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if not args.candidates.exists():
        print(f"ERROR: candidates file not found: {args.candidates}", file=sys.stderr)
        sys.exit(1)

    if not args.config.exists():
        print(f"ERROR: config file not found: {args.config}", file=sys.stderr)
        sys.exit(1)

    t_start = time.time()

    jd_text: Optional[str] = None
    if args.jd_text:
        if not args.jd_text.exists():
            print(f"ERROR: JD text file not found: {args.jd_text}", file=sys.stderr)
            sys.exit(1)
        jd_text = args.jd_text.read_text(encoding="utf-8", errors="replace")

    ranker.run(
        candidates_path=args.candidates,
        output_path=args.out,
        config_path=args.config,
        precomputed_embeddings_path=args.embeddings,
        precomputed_ids_path=args.embedding_ids,
        use_llm=args.use_llm,
        top_n=args.top_n,
        verbose=not args.quiet,
        jd_text=jd_text,
        validate_jd=not args.no_validate_jd,
        jd_report_path=args.jd_report,
    )

    elapsed = time.time() - t_start
    print(f"\nTotal wall-clock time: {elapsed:.1f}s")

    if elapsed > 300:
        print(
            "WARNING: exceeded 5-minute compute budget. "
            "Run precompute.py first to generate embeddings.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
