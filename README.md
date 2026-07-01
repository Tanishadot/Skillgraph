# SkillGraph AI — Intelligent Candidate Ranking

**Redrob × Hack2Skill India.Runs — Intelligent Candidate Discovery & Ranking Challenge**

SkillGraph AI is a 7-layer hybrid candidate ranking system that combines BM25 sparse retrieval, SBERT semantic embeddings, and six domain-specific scoring dimensions to surface the most relevant candidates from a large pool. It includes an explainable recruiter dashboard, a JD quality validator, hidden gem detection, fraud/honeypot filtering, and an AI Copilot chat assistant.

---

## Features

| Feature | Description |
|---|---|
| **7-Layer Ranking Pipeline** | JD Validation → BM25 → SBERT Semantic → Experience → Projects → Behavior → Career Growth |
| **JD Validator** | Detects impossible constraints (e.g. "10 years of PyTorch"), skill overload, and contradictions |
| **Hidden Gem Detection** | Surfaces high-fit candidates with low recruiter visibility (score ≥ 0.63, growth ≥ 0.70, rank > 20) |
| **Honeypot/Fraud Filter** | Detects zero-duration expert skills and anomalous skill counts |
| **Explainable Scores** | Per-dimension breakdown with weight, evidence, and natural-language reasoning for every candidate |
| **AI Copilot** | Rule-based + Claude-powered chat for natural-language queries about any ranked candidate |
| **Candidate Portal** | Self-service resume analysis against the active JD with improvement suggestions |
| **Compare View** | Side-by-side comparison of up to 5 candidates across all scoring dimensions |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND  React 18 · TypeScript · Vite · Tailwind  │
│  Dashboard · Rankings · JD Analysis · Hidden Talent  │
│  Analytics · Compare · AI Copilot · Candidate Portal │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST
┌──────────────────────▼──────────────────────────────┐
│  API LAYER  FastAPI · Pydantic v2 · Uvicorn          │
│  /candidates · /jd/validate · /analytics · /chat     │
└────┬──────┬──────┬──────┬──────┬────────────────────┘
     │      │      │      │      │
┌────▼──────▼──────▼──────▼──────▼────────────────────┐
│  ML ENGINE                                            │
│  JD Validator → BM25 → SBERT (all-MiniLM-L6-v2)     │
│  Weighted Scoring (Projects 28% · Exp 22% · Sem 20%) │
│  Penalties: Honeypot ×0.04 · Keyword Stuffer ×0.55  │
│  Hidden Gem Detector → Top-100 Ranked Output         │
└──────────────────────────────────────────────────────┘
```

---

## Scoring Weights

| Dimension | Weight | Signal |
|---|---|---|
| Projects | **28%** | Production ML depth, deployment history, stack |
| Experience | **22%** | Total years + AI/ML-specific years (peak at 7yr) |
| Semantic Match | **20%** | SBERT cosine similarity to JD embedding |
| Domain Fit | **12%** | Title and career trajectory alignment |
| Behavior | **8%** | Response rate, availability, notice period |
| Career Growth | **5%** | IC seniority progression |
| Education | **3%** | Degree tier + field relevance |
| Certifications | **2%** | ML/AI credentials |

**Penalty multipliers** (applied after weighted sum):
- Honeypot profile: **×0.04**
- Keyword stuffer (BM25 >> SBERT gap): **×0.55**
- Consulting-only background: **×0.40**

---

## Tech Stack

**Frontend:** React 18, TypeScript, Vite 5, TailwindCSS, Framer Motion, Recharts, TanStack Query, React Router v6, Lucide Icons

**Backend:** FastAPI, Python 3.11+, Pydantic v2, Uvicorn

**ML:** sentence-transformers (all-MiniLM-L6-v2, 384-dim), rank-bm25, scikit-learn, NumPy

**Data:** In-memory DataStore singleton, candidates.jsonl pool, submission.csv ranked output

---

## Folder Structure

```
.
├── agents/
│   ├── job_understanding_agent.py   # Layer 1: JD → HiringProfile
│   └── jd_validator.py              # Layer 0: JD quality validation
├── api/
│   ├── server.py                    # FastAPI routes
│   ├── data_loader.py               # In-memory data store
│   └── models.py                    # Pydantic response models
├── embeddings/
│   ├── model.py                     # SBERT / TF-IDF backend
│   └── indexer.py                   # Semantic index + cosine scoring
├── parsers/
│   └── candidate_parser.py          # Layer 2: raw JSON → CandidateProfile
├── pipeline/
│   ├── ranker.py                    # End-to-end orchestrator
│   └── jd_validation_pipeline.py   # JD validation pipeline
├── scoring/
│   ├── hybrid_scorer.py             # Layer 6: weighted composite
│   ├── project_scorer.py            # Layer 3: project depth
│   ├── semantic_matcher.py          # Layer 4: BM25 + blend
│   └── behavioral_scorer.py        # Layer 5: Redrob signals
├── utils/
│   ├── honeypot_detector.py         # Anomaly detection
│   └── explanation_generator.py    # Layer 7: per-candidate reasoning
├── config/
│   └── weights.yaml                 # All scoring weights (editable)
├── knowledge/
│   └── technology_timeline.yaml    # Tech mainstream-year reference
├── frontend/                        # React 18 dashboard
├── candidates.jsonl                 # Candidate pool (provided by organizers)
├── submission.csv                   # Output: top-100 ranked candidates
├── rank.py                          # CLI entry point
├── precompute.py                    # Pre-compute SBERT embeddings
└── requirements.txt
```

---

## Installation

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
# Clone the repository
git clone https://github.com/Tanishadot/Skillgraph.git
cd Skillgraph

# Install Python dependencies
pip install -r requirements.txt

# Place candidates.jsonl in the project root (provided by challenge organizers)
```

### Frontend

```bash
cd frontend
npm install
```

---

## Running Locally

### Step 1 — Run the ranking pipeline

```bash
python rank.py --candidates candidates.jsonl --out submission.csv
```

Optional: pre-compute SBERT embeddings for faster subsequent runs:

```bash
python precompute.py --candidates candidates.jsonl
python rank.py --candidates candidates.jsonl --out submission.csv --skip-embed
```

### Step 2 — Start the API server

```bash
uvicorn api.server:app --reload --port 8080
```

### Step 3 — Start the frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Optional: Enable AI Copilot (Claude-powered)

```bash
export ANTHROPIC_API_KEY=your_key_here
uvicorn api.server:app --reload --port 8080
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(none)* | Enables Claude-powered AI Copilot. Falls back to rule-based chat if unset. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated CORS allowed origins. |

---

## Pipeline Details

The ranking pipeline runs end-to-end in `rank.py`:

```
[0] JD Validator          → Detects impossible constraints, skill overload, contradictions
[1] JD Understanding      → Extracts structured HiringProfile from raw JD text
[2] Candidate Parser      → raw JSON → typed CandidateProfile with inferred signals
[3] Project Scorer        → Production signals, scale, ownership, AI stack depth
[4] Semantic Matcher      → SBERT cosine sim + BM25 over career descriptions (blended)
[5] Behavioral Scorer     → Redrob signals: response rate, recency, notice period
[6] Hybrid Scorer         → Weighted composite + penalty multipliers
[7] Explanation Generator → Natural-language reasoning per candidate
```

Output: `submission.csv` with columns `candidate_id, rank, score, reasoning`

---

## Submission Assets

| Asset | Description |
|---|---|
| `submission.csv` | Top-100 ranked candidates (required deliverable) |
| `skillgraph_submission.pptx` | Filled Redrob Idea Submission Template |
| `validate_submission.py` | Validates submission.csv format |
| `sample_submission.csv` | Reference format |
| `candidate_schema.json` | Input data schema |

---

## Demo

The dashboard includes 8 screens:

1. **Landing** — Project overview with live architecture diagram
2. **Dashboard** — Campaign header, AI insights, stat cards, top-5 candidates
3. **Rankings** — Paginated, filterable, sortable candidate list with score chips
4. **Candidate Detail** — Expandable score breakdown, career timeline, skills, hiring risk
5. **JD Analysis** — Paste/upload JD for quality validation and profile extraction
6. **Hidden Talent** — Hidden gem candidates surfaced from deeper in the ranking
7. **Analytics** — Score distribution, experience breakdown, funnel, location heatmap
8. **AI Copilot** — Natural-language queries about any ranked candidate
9. **Compare** — Side-by-side multi-candidate comparison
10. **Candidate Portal** — Candidate self-assessment against the active JD

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

- [Redrob](https://redrob.in) × [Hack2Skill](https://hack2skill.com) for organizing the India.Runs challenge
- [sentence-transformers](https://www.sbert.net/) for the all-MiniLM-L6-v2 embedding model
- [rank-bm25](https://github.com/dorianbrown/rank_bm25) for the BM25 implementation
- [FastAPI](https://fastapi.tiangolo.com/) and [React](https://react.dev/) teams
