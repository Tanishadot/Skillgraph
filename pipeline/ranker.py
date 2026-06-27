"""
Pipeline Orchestrator
Runs Layers 1–7 end-to-end:
  1  Job Understanding Agent   → HiringProfile (once)
  2  Candidate Parser          → CandidateProfile (per candidate)
  3  Project Scorer            → project_score (per candidate)
  4  Semantic Matcher          → semantic_score (batch via embeddings + BM25)
  5  Behavioral Scorer         → behavioral_score (per candidate)
  6  Hybrid Scorer             → final_score (per candidate)
  7  Explanation Generator     → reasoning (top-100 only)
"""
from __future__ import annotations
import json
import time
from pathlib import Path
from typing import List, Optional

import yaml
from tqdm import tqdm

from agents.job_understanding_agent import build as build_jd_profile, JD_TEXT
from pipeline import jd_validation_pipeline
from parsers import candidate_parser
from embeddings.indexer import SemanticIndex
from scoring import project_scorer, behavioral_scorer
from scoring import semantic_matcher as sem_matcher
from scoring import hybrid_scorer
from utils import honeypot_detector, explanation_generator


def _load_config(config_path: Path) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


def _load_candidates(jsonl_path: Path) -> List[dict]:
    candidates = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                candidates.append(json.loads(line))
    return candidates


def _assign_monotonic_scores(
    scored: List[hybrid_scorer.ScoredCandidate],
) -> List[hybrid_scorer.ScoredCandidate]:
    """
    Ensures final scores are non-increasing with rank and tie-breaks by
    candidate_id ascending (spec requirement).
    Scores are rounded to 4 d.p. before sorting so the sort order matches
    the printed CSV order, avoiding tie-break violations from float rounding.
    """
    # Round to the precision used in the CSV output
    for sc in scored:
        sc.final_score = round(sc.final_score, 4)

    scored.sort(key=lambda x: (-x.final_score, x.candidate_id))

    # Clamp any remaining score inversions (shouldn't happen after rounding, but defensive)
    prev_score = scored[0].final_score if scored else None
    for sc in scored[1:]:
        if sc.final_score > prev_score:
            sc.final_score = prev_score
        prev_score = sc.final_score

    return scored


def run(
    candidates_path: Path,
    output_path: Path,
    config_path: Path,
    precomputed_embeddings_path: Optional[Path] = None,
    precomputed_ids_path: Optional[Path] = None,
    use_llm: bool = False,
    top_n: int = 100,
    verbose: bool = True,
    jd_text: Optional[str] = None,
    validate_jd: bool = True,
    jd_report_path: Optional[Path] = None,
) -> List[hybrid_scorer.ScoredCandidate]:

    t0 = time.time()
    cfg = _load_config(config_path)

    # ── Layer 1: JD profile ────────────────────────────────────────────────
    if verbose:
        print("[1/7] Loading job profile...")
    jd = build_jd_profile()

    # ── Layer 0: JD Validation (optional but recommended) ─────────────────
    if validate_jd:
        if verbose:
            print("[0/7] Validating job description...")
        text = jd_text if jd_text else JD_TEXT
        try:
            jd = jd_validation_pipeline.run(
                text,
                jd,
                print_report=verbose,
                report_file=jd_report_path,
            )
        except Exception as exc:
            if verbose:
                print(f"      JD validation skipped ({exc})")


    # ── Load candidates ────────────────────────────────────────────────────
    if verbose:
        print(f"[*]   Loading candidates from {candidates_path.name}...")
    raw_candidates = _load_candidates(candidates_path)
    if verbose:
        print(f"      {len(raw_candidates):,} candidates loaded  ({time.time()-t0:.1f}s)")

    # ── Layer 2: Parse all candidates ─────────────────────────────────────
    if verbose:
        print("[2/7] Parsing candidate profiles...")
    profiles: List[candidate_parser.CandidateProfile] = []
    for raw in tqdm(raw_candidates, disable=not verbose, desc="  parse"):
        cp = candidate_parser.parse(raw)
        is_hp, reason = honeypot_detector.check(raw)
        cp.is_honeypot = is_hp
        cp.honeypot_reason = reason
        profiles.append(cp)

    if verbose:
        hp_count = sum(1 for p in profiles if p.is_honeypot)
        print(f"      {hp_count} honeypots detected  ({time.time()-t0:.1f}s)")

    # ── Layer 4 (prep): Semantic index ────────────────────────────────────
    if verbose:
        print("[4/7] Building semantic index...")

    emb_cfg = cfg.get("embedding", {})
    index = SemanticIndex(jd, emb_cfg)

    # Try to load pre-computed candidate embeddings
    precomp_emb = precomputed_embeddings_path or Path(emb_cfg.get("precomputed_embeddings", "candidate_embeddings.npy"))
    precomp_ids = precomputed_ids_path or Path(emb_cfg.get("precomputed_ids", "candidate_ids.json"))

    embedding_scores: dict = {}
    if index.load_precomputed(precomp_emb, precomp_ids):
        if verbose:
            print(f"      Using pre-computed embeddings from {precomp_emb.name}")
        index.build_jd_index()
        embedding_scores = index.score_all()
    else:
        if verbose:
            print("      Encoding candidates (this step may take 1–5 min depending on backend)...")
        texts = [p.embedding_text for p in profiles]
        ids = [p.candidate_id for p in profiles]
        # encode_candidates fits TF-IDF vocab and re-encodes JD queries internally
        index.encode_candidates(texts, ids, batch_size=emb_cfg.get("batch_size", 128), show_progress=verbose)
        if verbose:
            from embeddings import model as _emb
            print(f"      Embedding backend: {_emb.backend_name()}")
        embedding_scores = index.score_all()

    # ── Layer 4 (BM25): Build BM25 over career descriptions ───────────────
    if verbose:
        print("      Building BM25 index over career descriptions...")
    corpus = [p.career_descriptions_combined for p in profiles]
    bm25 = sem_matcher.BM25Scorer(corpus)
    bm25_scores_list = bm25.score_all()
    bm25_scores = {p.candidate_id: bm25_scores_list[i] for i, p in enumerate(profiles)}

    # ── Layers 3, 5, 6: Score every candidate ─────────────────────────────
    if verbose:
        print("[3/7] Scoring projects, behavior, hybrid...")
    scored_all: List[hybrid_scorer.ScoredCandidate] = []

    for i, cp in enumerate(tqdm(profiles, disable=not verbose, desc="  score")):
        # Layer 3
        proj_score, proj_breakdown = project_scorer.score(cp, cfg)

        # Layer 4 blend
        emb_s = embedding_scores.get(cp.candidate_id)
        bm25_s = bm25_scores.get(cp.candidate_id, 0.0)
        skill_s = sem_matcher.compute_skill_semantic_score(cp)
        sem_score = sem_matcher.blend(emb_s, bm25_s, skill_s, cp)

        # Layer 5
        beh_score = behavioral_scorer.score(cp, cfg)

        # Layer 6
        sc = hybrid_scorer.score(
            cp=cp,
            jd=jd,
            project_score=proj_score,
            semantic_score=sem_score,
            behavioral_score=beh_score,
            cfg=cfg,
            project_breakdown=proj_breakdown,
        )
        scored_all.append(sc)

    # ── Sort and trim to top-N ─────────────────────────────────────────────
    if verbose:
        print(f"[6/7] Sorting and selecting top {top_n}...")
    scored_all = _assign_monotonic_scores(scored_all)
    top_candidates = scored_all[:top_n]
    for i, sc in enumerate(top_candidates):
        sc.rank = i + 1

    # ── Layer 7: Generate explanations ─────────────────────────────────────
    if verbose:
        print("[7/7] Generating explanations...")

    llm_client = None
    if use_llm:
        try:
            import anthropic, os
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if api_key:
                llm_client = anthropic.Anthropic(api_key=api_key)
                if verbose:
                    print("      Using Claude API for explanations")
        except ImportError:
            if verbose:
                print("      anthropic package not installed — using template explanations")

    for sc in tqdm(top_candidates, disable=not verbose, desc="  explain"):
        sc.reasoning = explanation_generator.generate(sc, llm_client)

    # ── Write CSV ──────────────────────────────────────────────────────────
    if verbose:
        print(f"[*]   Writing {output_path.name}...")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        f.write("candidate_id,rank,score,reasoning\n")
        for sc in top_candidates:
            # Escape double-quotes in reasoning
            reason_escaped = sc.reasoning.replace('"', '""')
            f.write(f'{sc.candidate_id},{sc.rank},{sc.final_score:.4f},"{reason_escaped}"\n')

    elapsed = time.time() - t0
    if verbose:
        print(f"\nDone in {elapsed:.1f}s. Output: {output_path}")
        print(f"  Top 5: " + " | ".join(
            f"{sc.candidate_id}({sc.final_score:.3f})" for sc in top_candidates[:5]
        ))

    return top_candidates
