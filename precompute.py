#!/usr/bin/env python3
"""
Pre-computation script (run once, result reused by rank.py).
Generates and saves candidate embeddings to disk.

Usage:
    python precompute.py --candidates ./candidates.jsonl

Output:
    candidate_embeddings.npy   (float32 numpy array, shape [N, D])
    candidate_ids.json         (list of candidate_id strings)

After running this, rank.py will auto-detect and load the files,
keeping the ranking step well within the 5-minute compute budget.
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import yaml
from tqdm import tqdm

from parsers import candidate_parser
from embeddings import model as emb_model
from embeddings.indexer import SemanticIndex
from agents.job_understanding_agent import build as build_jd_profile


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--candidates", required=True, type=Path)
    p.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).parent / "config" / "weights.yaml",
    )
    p.add_argument(
        "--out-embeddings",
        type=Path,
        default=Path("candidate_embeddings.npy"),
    )
    p.add_argument(
        "--out-ids",
        type=Path,
        default=Path("candidate_ids.json"),
    )
    p.add_argument("--batch-size", type=int, default=128)
    args = p.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    emb_cfg = cfg.get("embedding", {})
    model_name = emb_cfg.get("model_name", "all-MiniLM-L6-v2")

    print(f"Loading candidates from {args.candidates}...")
    t0 = time.time()
    raws = []
    with open(args.candidates, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                raws.append(json.loads(line))
    print(f"  {len(raws):,} candidates loaded ({time.time()-t0:.1f}s)")

    print("Parsing profiles...")
    profiles = [candidate_parser.parse(raw) for raw in tqdm(raws, desc="  parse")]

    texts = [p.embedding_text for p in profiles]
    ids = [p.candidate_id for p in profiles]

    print(f"Encoding {len(texts):,} texts with {model_name} (batch_size={args.batch_size})...")
    print("  This may take 3–8 minutes on CPU...")
    t1 = time.time()

    jd = build_jd_profile()
    index = SemanticIndex(jd, emb_cfg)
    index.encode_candidates(
        texts, ids,
        batch_size=args.batch_size,
        show_progress=True,
    )
    index.save_precomputed(args.out_embeddings, args.out_ids)

    elapsed = time.time() - t1
    print(f"\nEmbeddings saved:")
    print(f"  {args.out_embeddings}  (shape {index.candidate_embeddings.shape})")
    print(f"  {args.out_ids}")
    print(f"  Encoding time: {elapsed:.1f}s")
    print("\nNow run:")
    print("  python rank.py --candidates ./candidates.jsonl --out ./submission.csv")


if __name__ == "__main__":
    main()
