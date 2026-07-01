"""
SkillGraph AI — System Architecture Diagram
Output: skillgraph_architecture.png (3000×1688 @ 150 dpi)

Run: python generate_diagram.py
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from pathlib import Path

# ── Canvas ────────────────────────────────────────────────────────────────────
DPI  = 150
W, H = 20.0, 11.25   # 16:9

# ── Palette ───────────────────────────────────────────────────────────────────
BG    = '#09090B'
VIO   = '#7C3AED'
VIO_L = '#A78BFA'
BLU   = '#3B82F6'
BLU_L = '#93C5FD'
EMR   = '#10B981'
EMR_L = '#6EE7B7'
AMB   = '#F59E0B'
RSE   = '#F43F5E'
WHT   = '#F8FAFC'
LGR   = '#A1A1AA'
GRY   = '#52525B'
DRK   = '#18181B'
DRK2  = '#27272A'
DRK3  = '#3F3F46'

fig, ax = plt.subplots(figsize=(W, H), dpi=DPI)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.axis('off')
fig.subplots_adjust(left=0, right=1, top=1, bottom=0)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def rbox(ax, x, y, w, h, fc=DRK2, ec=GRY, lw=1.0, pad=0.1, zorder=4, alpha=1.0):
    r = FancyBboxPatch((x, y), w, h,
                       boxstyle=f"round,pad={pad}",
                       linewidth=lw, edgecolor=ec,
                       facecolor=fc, zorder=zorder, alpha=alpha)
    ax.add_patch(r)
    return r

def label(ax, x, y, text, color=WHT, fs=8, bold=False, ha='center', va='center',
          rot=0, alpha=1.0, zorder=5):
    ax.text(x, y, text, color=color, fontsize=fs,
            fontweight='bold' if bold else 'normal',
            ha=ha, va=va, rotation=rot, alpha=alpha,
            fontfamily='DejaVu Sans', zorder=zorder)

def comp(ax, x, y, w, h, title, sub='', fc=DRK2, ec=GRY, tc=WHT, sc=LGR, fs=8):
    """Component box with optional subtitle."""
    rbox(ax, x, y, w, h, fc=fc, ec=ec, lw=1.2, pad=0.08)
    if sub:
        label(ax, x + w/2, y + h * 0.62, title, color=tc, fs=fs, bold=True)
        label(ax, x + w/2, y + h * 0.28, sub,   color=sc, fs=fs - 2.0)
    else:
        label(ax, x + w/2, y + h/2, title, color=tc, fs=fs, bold=True)

def layer_band(ax, x, y, w, h, color, side_label, tech_line):
    """Full-width layer background."""
    rbox(ax, x, y, w, h, fc=color + '14', ec=color, lw=1.8, pad=0.18, zorder=1)
    # Vertical side label
    label(ax, x + 0.28, y + h/2, side_label,
          color=color, fs=10, bold=True, rot=90, zorder=3)
    # Tech stack line at the bottom of the band
    label(ax, x + w/2, y + 0.27, tech_line,
          color=color, fs=6.2, alpha=0.7, zorder=3)

def v_arrow(ax, x, y_top, y_bot, color=GRY, bidir=True, lbl=''):
    style = '<->' if bidir else '->'
    ax.annotate('', xy=(x, y_bot), xytext=(x, y_top),
                arrowprops=dict(arrowstyle=style, color=color,
                                lw=1.4, mutation_scale=13),
                zorder=7)
    if lbl:
        label(ax, x + 0.15, (y_top + y_bot) / 2, lbl,
              color=color, fs=6.5, ha='left', alpha=0.9, zorder=8)

def h_arrow(ax, x1, x2, y, color=GRY):
    ax.annotate('', xy=(x2, y), xytext=(x1, y),
                arrowprops=dict(arrowstyle='->', color=color,
                                lw=1.2, mutation_scale=10),
                zorder=7)

def score_bar(ax, x, y, w, h, segments):
    """Horizontal stacked bar for weight breakdown."""
    rbox(ax, x, y, w, h, fc=DRK3, ec=GRY + '66', lw=0.8, pad=0.06, zorder=4)
    cur = x + 0.08
    inner_w = w - 0.16
    for seg_label, pct, color in segments:
        sw = inner_w * pct
        rbox(ax, cur, y + 0.07, sw, h - 0.14, fc=color + 'AA', ec='none', lw=0, pad=0.0)
        if sw > 0.55:
            label(ax, cur + sw/2, y + h/2, f"{seg_label}\n{int(pct*100)}%",
                  color=WHT, fs=5.5, bold=True)
        cur += sw


# ═══════════════════════════════════════════════════════════════════════════════
# TITLE
# ═══════════════════════════════════════════════════════════════════════════════

label(ax, W/2, 10.75, 'SkillGraph AI — System Architecture',
      color=WHT, fs=15, bold=True, ha='center')
label(ax, W/2, 10.45, '7-Layer Hybrid Candidate Ranking  ·  FastAPI + React 18 + SBERT',
      color=LGR, fs=8.5, ha='center', alpha=0.8)

# horizontal rule
ax.axhline(10.28, xmin=0.02, xmax=0.98, color=GRY, lw=0.6, alpha=0.4, zorder=2)


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 1 — FRONTEND  (y=8.0 → 10.1)
# ═══════════════════════════════════════════════════════════════════════════════

L1_Y, L1_H = 8.0, 2.05
layer_band(ax, 0.3, L1_Y, W - 0.6, L1_H, VIO,
           'FRONTEND',
           'React 18  ·  TypeScript  ·  Vite 5  ·  TailwindCSS  ·  Framer Motion  ·  '
           'Recharts  ·  TanStack Query  ·  React Router v6')

# Page boxes — row 1 (y=9.15)
pages_r1 = ['Dashboard', 'Rankings', 'JD Analysis', 'Hidden Talent']
pages_r2 = ['Analytics', 'Compare', 'AI Copilot', 'Candidate Portal']
BOX_W, BOX_H = 2.18, 0.62
PAGES_START_X = 0.9
GAP = 0.22

for i, pg in enumerate(pages_r1):
    bx = PAGES_START_X + i * (BOX_W + GAP)
    comp(ax, bx, 9.20, BOX_W, BOX_H, pg, fc=VIO + '22', ec=VIO_L, tc=VIO_L, fs=7.8)

for i, pg in enumerate(pages_r2):
    bx = PAGES_START_X + i * (BOX_W + GAP)
    comp(ax, bx, 8.44, BOX_W, BOX_H, pg, fc=VIO + '22', ec=VIO_L, tc=VIO_L, fs=7.8)


# ═══════════════════════════════════════════════════════════════════════════════
# ARROW: Frontend ↔ API
# ═══════════════════════════════════════════════════════════════════════════════

v_arrow(ax, W/2, L1_Y, L1_Y - 0.65, color=BLU_L, bidir=True, lbl='  HTTP / REST  (port 8080)')


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 2 — API LAYER  (y=5.65 → 7.28)
# ═══════════════════════════════════════════════════════════════════════════════

L2_Y, L2_H = 5.65, 1.68
layer_band(ax, 0.3, L2_Y, W - 0.6, L2_H, BLU,
           'API LAYER',
           'FastAPI  ·  Python 3.11  ·  Pydantic v2  ·  Uvicorn  ·  CORS  ·  '
           'Auto OpenAPI Docs  ·  Async Routes')

endpoints = [
    ('/candidates',   'ranking list'),
    ('/jd/validate',  'JD quality'),
    ('/jd/profile',   'hiring config'),
    ('/analytics',    'pipeline stats'),
    ('/compare',      'side-by-side'),
    ('/portal/*',     'self-assess'),
    ('/chat',         'AI copilot'),
]

EP_W = 2.38
EP_H = 0.72
EP_START = 0.75
EP_GAP = 0.13

for i, (ep, sub) in enumerate(endpoints):
    bx = EP_START + i * (EP_W + EP_GAP)
    comp(ax, bx, 6.22, EP_W, EP_H, ep, sub=sub,
         fc=BLU + '1A', ec=BLU_L, tc=BLU_L, sc=LGR, fs=7.5)


# ═══════════════════════════════════════════════════════════════════════════════
# ARROW: API ↔ ML Engine
# ═══════════════════════════════════════════════════════════════════════════════

v_arrow(ax, W/2, L2_Y, L2_Y - 0.72, color=EMR_L, bidir=True, lbl='  Python function calls')


# ═══════════════════════════════════════════════════════════════════════════════
# LAYER 3 — ML ENGINE  (y=0.45 → 4.88)
# ═══════════════════════════════════════════════════════════════════════════════

L3_Y, L3_H = 0.45, 4.48
layer_band(ax, 0.3, L3_Y, W - 0.6, L3_H, EMR,
           'ML ENGINE',
           'sentence-transformers (all-MiniLM-L6-v2)  ·  rank-bm25  ·  '
           'scikit-learn  ·  NumPy  ·  DataStore singleton  ·  submission.csv')

# ── Row A: Ranking pipeline (top of ML layer) ─────────────────────────────────
PIPE_Y = 3.92
PIPE_H = 0.72
pipe = [
    ('JD Validator',    'quality check +\nstructured profile'),
    ('BM25 Retrieval',  'sparse keyword\nindex (rank-bm25)'),
    ('SBERT Scoring',   'all-MiniLM-L6-v2\n384-dim cosine sim'),
    ('Experience',      'peak-weight fn\n(max @ 7 yrs)'),
    ('Projects',        'ML depth +\nprod deployments'),
    ('Behavior',        'response rate,\nopen_to_work'),
    ('Career Growth',   'IC seniority\nprogression'),
]

PIPE_BOX_W = 2.38
PIPE_GAP   = 0.20
PIPE_START = 0.72

for i, (ttl, sub) in enumerate(pipe):
    bx = PIPE_START + i * (PIPE_BOX_W + PIPE_GAP)
    fc = EMR + '22' if i < 3 else VIO + '22'
    ec = EMR_L if i < 3 else VIO_L
    tc = EMR_L if i < 3 else VIO_L
    comp(ax, bx, PIPE_Y, PIPE_BOX_W, PIPE_H, ttl, sub=sub,
         fc=fc, ec=ec, tc=tc, sc=LGR, fs=7.2)
    if i < len(pipe) - 1:
        h_arrow(ax, bx + PIPE_BOX_W + 0.03, bx + PIPE_BOX_W + PIPE_GAP - 0.03,
                PIPE_Y + PIPE_H / 2, color=GRY)

# Label for pipeline row
label(ax, 0.6, PIPE_Y + PIPE_H/2, '7-LAYER\nPIPELINE', color=EMR, fs=5.8, bold=True,
      ha='center', va='center', alpha=0.8)

# ── Down arrow to weighted scoring ────────────────────────────────────────────
v_arrow(ax, W/2, PIPE_Y, PIPE_Y - 0.28, color=GRY, bidir=False)

# ── Row B: Weighted scoring bar ───────────────────────────────────────────────
SCORE_Y = 2.72
SCORE_H = 0.72
label(ax, 0.6, SCORE_Y + SCORE_H/2, 'WEIGHTED\nSCORING', color=EMR, fs=5.8, bold=True,
      ha='center', va='center', alpha=0.8)
score_bar(ax, 0.72, SCORE_Y, 18.58, SCORE_H, [
    ('Projects',   0.28, VIO),
    ('Experience', 0.22, BLU),
    ('Semantic',   0.20, EMR),
    ('Domain',     0.12, AMB),
    ('Behavior',   0.08, '#8B5CF6'),
    ('Growth',     0.05, '#06B6D4'),
    ('Education',  0.03, '#84CC16'),
    ('Certs',      0.02, '#F97316'),
])

# ── Down arrow to penalties ────────────────────────────────────────────────────
v_arrow(ax, W/2, SCORE_Y, SCORE_Y - 0.28, color=GRY, bidir=False)

# ── Row C: Penalty system + Detection + Data ──────────────────────────────────
ROW_C_Y  = 1.52
ROW_C_H  = 0.82

label(ax, 0.6, ROW_C_Y + ROW_C_H/2, 'OUTPUTS\n& DATA', color=EMR, fs=5.8, bold=True,
      ha='center', va='center', alpha=0.8)

penalty_items = [
    ('Honeypot Filter',     'career_growth < 0.20\npenalty  ×0.04',   RSE),
    ('Keyword Stuffer',     'BM25 >> SBERT gap\npenalty  ×0.55',      AMB),
    ('Consulting-Only',     'no IC roles detected\npenalty  ×0.40',    AMB),
    ('Hidden Gem Detect.',  'rank > 20 + growth ≥ 0.70\n+ low visibility', AMB),
    ('Top-100 Ranked',      'score breakdown +\nnatural-lang reasoning', EMR),
    ('SBERT Cache',         'embeddings pre-loaded\nat startup',        BLU),
    ('DataStore + CSV',     'submission.csv\nin-memory BM25 idx',       BLU),
]

P_BOX_W = 2.38
P_GAP   = 0.20
P_START = 0.72

for i, (ttl, sub, color) in enumerate(penalty_items):
    bx = P_START + i * (P_BOX_W + P_GAP)
    comp(ax, bx, ROW_C_Y, P_BOX_W, ROW_C_H, ttl, sub=sub,
         fc=color + '18', ec=color, tc=color, sc=LGR, fs=7.0)


# ═══════════════════════════════════════════════════════════════════════════════
# LEGEND
# ═══════════════════════════════════════════════════════════════════════════════

LGND_X, LGND_Y = 0.5, 10.1
legend_items = [
    (VIO_L, 'Frontend layer'),
    (BLU_L, 'API layer'),
    (EMR_L, 'ML engine'),
    (RSE,   'Fraud / penalty'),
    (AMB,   'Detection / penalty'),
]
for i, (c, t) in enumerate(legend_items):
    lx = LGND_X + i * 3.0
    rbox(ax, lx, LGND_Y - 0.03, 0.3, 0.22, fc=c + '30', ec=c, lw=1.0, pad=0.03, zorder=8)
    label(ax, lx + 0.44, LGND_Y + 0.08, t, color=LGR, fs=6.2, ha='left', zorder=9)


# ═══════════════════════════════════════════════════════════════════════════════
# Save
# ═══════════════════════════════════════════════════════════════════════════════

out = Path(__file__).parent / 'skillgraph_architecture.png'
fig.savefig(str(out), dpi=DPI, bbox_inches='tight',
            facecolor=BG, edgecolor='none')
plt.close(fig)
print(f"Saved: {out}")
print(f"Size:  {int(W*DPI)} × {int(H*DPI)} px")
