"""
Layer 4: Semantic Matching
Two complementary approaches:
  1. Embedding-based cosine similarity (primary, from SemanticIndex)
  2. BM25 over career descriptions (secondary, always available, fast)

The final semantic score blends both.
BM25 catches explicit domain keywords; embeddings catch related technologies
and paraphrase (e.g. "FAISS" ≈ "vector search", "LoRA" ≈ "LLM fine-tuning").
"""
from __future__ import annotations
from typing import List, Dict, Optional
import math
import re
from parsers.candidate_parser import CandidateProfile
from agents.job_understanding_agent import HiringProfile
from utils.text_utils import normalize


# ── BM25 query terms derived from the JD ──────────────────────────────────

JD_BM25_TERMS = [
    # Must-have retrieval/vector
    "embedding", "retrieval", "vector", "faiss", "elasticsearch",
    "pinecone", "weaviate", "qdrant", "milvus", "chroma", "opensearch",
    "dense", "sparse", "hybrid", "bm25", "ann",
    "sentence transformer", "sentence-transformer",
    # Evaluation
    "ndcg", "map", "mrr", "ranking", "evaluation",
    "a/b test", "learning to rank",
    # LLM/fine-tuning
    "fine-tun", "lora", "qlora", "peft", "llm",
    "transformer", "hugging face", "rag",
    # Core ML
    "pytorch", "tensorflow", "nlp", "information retrieval",
    "recommendation", "search engine",
    # Production
    "production", "deployed", "model serving",
    "mlops", "mlflow",
    # Domain relevance
    "candidate ranking", "talent", "recruiter", "job matching",
]

# Soft negative terms — high frequency of these without AI context suggests mismatch
SOFT_NEGATIVE_TERMS = [
    "photoshop", "illustrator", "figma", "react", "angular",
    "accounting", "tally", "salesforce crm", "content writing",
    "seo ", "civil engineer", "mechanical design", "solidworks",
]


class BM25Scorer:
    """
    Lightweight BM25 over candidate career descriptions.
    Built once at ranking time and queried per candidate.
    Uses the JD terms as the query; returns a normalised score per candidate.
    """
    k1 = 1.5
    b = 0.75

    def __init__(self, corpus: List[str]):
        self.n = len(corpus)
        self.tokenised = [self._tokenise(doc) for doc in corpus]
        self.avgdl = sum(len(t) for t in self.tokenised) / max(self.n, 1)
        self.df: Dict[str, int] = {}
        for tokens in self.tokenised:
            for tok in set(tokens):
                self.df[tok] = self.df.get(tok, 0) + 1

    @staticmethod
    def _tokenise(text: str) -> List[str]:
        text = normalize(text)
        return re.findall(r"\w+", text)

    def _idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        return math.log((self.n - df + 0.5) / (df + 0.5) + 1)

    def score_doc(self, idx: int) -> float:
        tokens = self.tokenised[idx]
        if not tokens:
            return 0.0
        dl = len(tokens)
        tf_map: Dict[str, int] = {}
        for t in tokens:
            tf_map[t] = tf_map.get(t, 0) + 1

        total = 0.0
        for term in JD_BM25_TERMS:
            # BM25 supports multi-token terms by treating them as a unit
            term_tokens = self._tokenise(term)
            tf = min(tf_map.get(t, 0) for t in term_tokens) if term_tokens else 0
            if tf == 0:
                continue
            idf = sum(self._idf(t) for t in term_tokens) / len(term_tokens)
            numerator = tf * (self.k1 + 1)
            denominator = tf + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            total += idf * numerator / denominator

        return total

    def score_all(self) -> List[float]:
        raw = [self.score_doc(i) for i in range(self.n)]
        max_val = max(raw) if raw else 1.0
        if max_val == 0:
            return raw
        return [r / max_val for r in raw]  # normalise to [0, 1]


def compute_skill_semantic_score(cp: CandidateProfile) -> float:
    """
    Lightweight skill-level semantic match:
    counts JD-relevant tier-1 + tier-2 AI skills (already extracted by parser),
    normalises against an expected "ideal" count.
    """
    t1 = len(cp.tier1_ai_skills)
    t2 = len(cp.tier2_ai_skills)
    # Ideal: 5 tier-1 and 5 tier-2 skills at expert/advanced level
    raw = min(t1 * 2.0 + t2 * 1.0, 15.0)
    return raw / 15.0


def blend(
    embedding_score: Optional[float],
    bm25_score: float,
    skill_semantic_score: float,
    cp: CandidateProfile,
) -> float:
    """
    Combine three signals into the final semantic match score.
    If embedding score is available, it is the primary signal.
    """
    # Soft negative penalty: if career descriptions are full of non-AI terms
    desc_lower = cp.career_descriptions_combined.lower()
    neg_hits = sum(1 for t in SOFT_NEGATIVE_TERMS if t in desc_lower)
    neg_penalty = min(0.20, neg_hits * 0.04)

    if embedding_score is not None:
        # Primary: embeddings (semantic), secondary: BM25 (keyword), tertiary: skill tier
        combined = 0.55 * embedding_score + 0.30 * bm25_score + 0.15 * skill_semantic_score
    else:
        # Fallback when no pre-computed embeddings
        combined = 0.50 * bm25_score + 0.35 * skill_semantic_score + 0.15 * bm25_score

    return max(0.0, min(1.0, combined - neg_penalty))
