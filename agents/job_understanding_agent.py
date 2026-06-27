"""
Layer 1: Job Understanding Agent
Produces a structured hiring profile from the JD.
Encodes what an experienced technical recruiter would extract after reading the JD carefully —
responsibilities, hard requirements, soft preferences, disqualifiers, and behavioural expectations.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict

# Raw JD text for the Redrob Senior AI Engineer role.
# Used by jd_validator.py when no external --jd-text file is provided.
JD_TEXT = """
Senior AI Engineer — Founding Team
Company: Redrob AI (Series A, Pune / Noida)

About the Role
We are building the intelligence layer of the next-generation recruitment platform.
As a Senior AI Engineer on the founding team, you will own the ranking, retrieval,
and candidate-JD matching system end to end.

Responsibilities
- Own and ship v2 of the candidate ranking system using embeddings and hybrid retrieval
- Design and implement dense + sparse (BM25) hybrid search pipelines
- Build evaluation infrastructure: offline benchmarks (NDCG, MAP, MRR), A/B testing
- Drive the candidate-JD matching architecture at scale (millions of candidates)
- Mentor the next round of engineering hires
- Collaborate with the product manager to translate requirements into engineering specs

Required Skills & Experience
- 5+ years of experience in applied machine learning or AI engineering
- 4+ years of experience with Python in production environments
- 3+ years of experience with NLP / information retrieval
- Strong experience with embedding models: sentence-transformers, BGE, E5, OpenAI embeddings
- Production experience with vector databases: FAISS, Qdrant, Weaviate, Pinecone, or Milvus
- Experience building retrieval systems: dense retrieval, sparse retrieval, hybrid search, RAG
- Deep understanding of ranking evaluation metrics: NDCG, MAP, MRR, precision, recall
- Experience with LLM fine-tuning: LoRA, QLoRA, PEFT, instruction tuning
- Strong knowledge of transformer architectures (Hugging Face Transformers, PyTorch)
- Experience deploying ML models to production: FastAPI, Triton, or similar serving frameworks
- MLOps experience: MLflow, Weights & Biases, experiment tracking

Nice to Have
- Learning-to-rank experience: LambdaRank, RankNet, XGBoost ranking
- Experience with distributed systems and large-scale inference
- Open-source contributions or research publications
- HR tech or recruiting domain experience
- Startup / founding team experience

What We're NOT Looking For
- Candidates from pure consulting backgrounds (TCS, Infosys, Wipro, Accenture — only consulting)
- Engineers who only write LangChain wrappers with no underlying AI understanding
- Candidates who haven't written production code in 18+ months
- Primarily CV / speech / robotics specialists without NLP or IR transfer

Location
Preferred: Pune, Noida, Delhi NCR
Acceptable: Hyderabad, Mumbai, Bangalore, Chennai, Kolkata, Gurgaon

Notice Period
Ideal: up to 30 days. Acceptable: up to 90 days.

Employment Type: Full-time, permanent
"""


@dataclass
class HiringProfile:
    role: str
    company: str
    company_stage: str

    # Experience expectations
    experience_min_years: int
    experience_max_years: int
    experience_ideal_years: List[int]
    ai_ml_min_years: float      # minimum years in applied ML/AI roles

    # Responsibility areas
    primary_responsibilities: List[str]

    # Skills — hierarchical importance
    must_have_skill_categories: Dict[str, List[str]]   # category -> canonical terms
    nice_to_have_skills: List[str]

    # Experience types required
    required_experience_types: List[str]
    preferred_experience_types: List[str]

    # Hard disqualifiers (these candidates should rank near bottom)
    disqualifiers: List[str]
    consulting_only_is_disqualifier: bool

    # Soft penalties (reduce score but not eliminate)
    soft_penalties: List[str]

    # Location
    preferred_locations: List[str]
    acceptable_locations: List[str]
    country_required: str   # "India" or "" for global

    # Behavioural expectations from the JD
    notice_period_ideal_days: int
    notice_period_soft_limit_days: int

    # Semantic query texts for embedding-based matching
    jd_query_texts: List[str]

    # Short summary for explanation context
    role_summary: str


def build() -> HiringProfile:
    """
    Returns the structured hiring profile for:
    Senior AI Engineer — Founding Team, Redrob AI, Pune/Noida.

    Every field below maps directly to language in the JD document.
    """
    return HiringProfile(
        role="Senior AI Engineer",
        company="Redrob AI",
        company_stage="Series A",

        experience_min_years=5,
        experience_max_years=9,
        experience_ideal_years=[6, 7, 8],
        ai_ml_min_years=3.0,

        primary_responsibilities=[
            "own ranking, retrieval, and matching intelligence layer",
            "ship v2 ranking system with embeddings and hybrid retrieval",
            "set up evaluation infrastructure: offline benchmarks, A/B testing",
            "drive candidate-JD matching architecture at scale",
            "mentor next round of hires, collaborate with PM",
        ],

        must_have_skill_categories={
            "embeddings_and_retrieval": [
                "sentence-transformers", "sentence transformers",
                "bge", "e5", "openai embeddings",
                "dense retrieval", "embedding retrieval",
                "hybrid retrieval", "bm25", "sparse retrieval",
                "faiss", "pinecone", "weaviate", "qdrant", "milvus", "chroma",
                "opensearch", "elasticsearch",
                "vector database", "vector search", "ann",
                "approximate nearest neighbor",
                "rag", "retrieval augmented generation",
            ],
            "ranking_and_evaluation": [
                "ndcg", "map", "mrr", "precision", "recall",
                "learning to rank", "lambdarank", "ranknet",
                "a/b testing", "online evaluation", "offline evaluation",
                "ranking evaluation", "retrieval evaluation",
                "xgboost ranking",
            ],
            "llm_and_fine_tuning": [
                "lora", "qlora", "peft", "fine-tuning", "fine tuning",
                "instruction tuning", "rlhf",
                "transformers", "hugging face", "huggingface",
                "llm", "large language model",
            ],
            "ml_engineering": [
                "pytorch", "tensorflow", "mlflow", "weights & biases", "wandb",
                "mlops", "model serving", "triton", "model deployment",
                "fastapi", "model optimization", "onnx",
            ],
            "core_nlp_and_ir": [
                "nlp", "natural language processing",
                "information retrieval", "text embedding",
                "python",
            ],
        },

        nice_to_have_skills=[
            "lora", "qlora", "peft",
            "learning to rank", "xgboost", "lambdarank",
            "distributed systems", "large-scale inference",
            "open-source contributions", "research papers",
            "hr tech", "recruiting technology", "marketplace",
        ],

        required_experience_types=[
            "production deployment",
            "product company (not pure consulting)",
            "ranking or retrieval or recommendation system shipped to real users",
            "embedding retrieval in production",
            "vector database operational experience",
            "ranking evaluation framework design",
        ],

        preferred_experience_types=[
            "startup or founding team experience",
            "end-to-end system ownership",
            "cross-functional collaboration with PM",
            "mentoring junior engineers",
            "open-source or research publications",
        ],

        # JD-explicit disqualifiers
        disqualifiers=[
            "pure_research_no_production",    # academic/research labs, no prod
            "langchain_only_llm_wrappers",    # <12mo AI, only LangChain wrappers
            "no_code_18_months",              # architect/tech lead not writing code
            "primarily_cv_speech_robotics",   # wrong domain without NLP/IR transfer
            "consulting_only_career",
        ],
        consulting_only_is_disqualifier=True,

        soft_penalties=[
            "currently_at_consulting_with_prior_product",  # penalise less
            "high_notice_period_over_90",
            "not_india_not_willing_to_relocate",
            "keyword_stuffer",   # AI skills but career/title show no AI work
            "no_github_linked",
        ],

        preferred_locations=["Pune", "Noida", "Delhi", "Delhi NCR", "New Delhi"],
        acceptable_locations=[
            "Hyderabad", "Mumbai", "Bangalore", "Bengaluru",
            "Chennai", "Kolkata", "Ahmedabad", "Gurgaon", "Gurugram",
        ],
        country_required="India",

        notice_period_ideal_days=30,
        notice_period_soft_limit_days=90,

        # These are the semantic queries used for embedding-based matching.
        # Each query represents a different facet of the JD requirement.
        jd_query_texts=[
            "production embedding retrieval system dense sparse hybrid search",
            "vector database FAISS Elasticsearch Qdrant Weaviate Milvus Pinecone ANN",
            "NDCG MAP MRR ranking evaluation A/B testing offline online metrics",
            "LLM fine-tuning LoRA QLoRA PEFT instruction tuning transformer models",
            "applied machine learning NLP information retrieval search ranking recommendation",
            "Python senior ML engineer production code deployment model serving",
            "search engine ranking recommendation system real users scale startup",
            "AI engineer founding team Series A startup product company",
        ],

        role_summary=(
            "Senior AI Engineer, Redrob AI (Series A). "
            "Own the ranking, retrieval, and candidate-JD matching intelligence layer. "
            "Must have production embeddings + vector DB experience. "
            "Must have ranking evaluation expertise (NDCG/MAP). "
            "Target: 6–8 years, 4–5 in applied ML at product companies. "
            "Strong Python, production code mindset, not pure researcher. "
            "Location: Pune/Noida preferred; major Indian cities acceptable. "
            "Notice: ≤30 days ideal, ≤90 days workable."
        ),
    )
