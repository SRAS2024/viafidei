"""
intelligence.core — deterministic primitives for the worker brain.

Pure stdlib. Everything here is deterministic: the same input always
produces the same output, which keeps the brain testable and auditable.

The embedding/cosine/Budget/Belief/Memory/Thought/Action definitions are
ported faithfully from the operator-provided worker-brain script; the
text-similarity helpers (accent folding, slug similarity, Levenshtein,
Jaccard, token sets) are additions the duplicate-detection, source and
relationship operations build on.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple


# ── Scalar helpers (ported) ──────────────────────────────────────────
def now() -> float:
    return time.time()


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def stable_hash(text: str) -> int:
    """Deterministic 64-bit hash, stable across processes and runs."""
    return int(hashlib.blake2b(text.encode("utf-8"), digest_size=8).hexdigest(), 16)


# ── Text normalisation ───────────────────────────────────────────────
_PUNCT = ".,:;!?()[]{}\"'`*_#<>|/\\—–-"


def strip_accents(text: str) -> str:
    """Fold accents so "Thérèse" matches "Therese"."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def normalize_text(text: str) -> str:
    """Lowercase, accent-fold and collapse whitespace for comparison."""
    folded = strip_accents(text).lower()
    return re.sub(r"\s+", " ", folded).strip()


def slugify(text: str) -> str:
    """Approximate the app's slug shape for slug-similarity checks."""
    folded = strip_accents(text).lower()
    return re.sub(r"[^a-z0-9]+", "-", folded).strip("-")


def tokenize(text: str) -> List[str]:
    """Whitespace tokenisation with punctuation stripped (ported shape)."""
    return [w.strip(_PUNCT).lower() for w in text.split()]


def token_set(text: str) -> set:
    """Accent-folded set of non-empty tokens, for Jaccard overlap."""
    return {t for t in tokenize(strip_accents(text)) if t}


# ── Embeddings (ported) ──────────────────────────────────────────────
def sparse_embed(text: str, dims: int = 512) -> Dict[int, float]:
    """L2-normalised sparse bag-of-words embedding keyed by hashed dim.

    Deterministic and offline. Good enough to surface conceptual overlap
    (shared vocabulary) without a model or an API; a real embedding model
    can be slotted in later behind the same interface.
    """
    vec: Dict[int, float] = {}
    for w in tokenize(text):
        if not w:
            continue
        i = stable_hash(w) % dims
        vec[i] = vec.get(i, 0.0) + 1.0
    norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
    return {k: v / norm for k, v in vec.items()}


def cosine(a: Dict[int, float], b: Dict[int, float]) -> float:
    """Cosine similarity of two L2-normalised sparse vectors (0..1)."""
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(k, 0.0) for k, v in a.items())


def embed_to_json(vec: Dict[int, float]) -> str:
    """Compact JSON form for storage/transport (string keys)."""
    return json.dumps({str(k): round(v, 6) for k, v in vec.items()}, separators=(",", ":"))


def embed_from_json(text: str) -> Dict[int, float]:
    """Inverse of ``embed_to_json``."""
    return {int(k): float(v) for k, v in json.loads(text).items()}


# ── String similarity ────────────────────────────────────────────────
def levenshtein(a: str, b: str) -> int:
    """Classic edit distance (two-row DP)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def str_ratio(a: str, b: str) -> float:
    """Normalised string similarity in 0..1 (1.0 == identical)."""
    if not a and not b:
        return 1.0
    longest = max(len(a), len(b)) or 1
    return 1.0 - levenshtein(a, b) / longest


def jaccard(a: set, b: set) -> float:
    """Jaccard overlap of two sets (0..1)."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


# ── Bounded-rationality dataclasses (ported) ─────────────────────────
@dataclass(slots=True)
class Budget:
    max_steps: int = 12
    max_seconds: float = 8.0
    max_tool_calls: int = 6
    min_confidence: float = 0.62

    started: float = field(default_factory=now)
    steps: int = 0
    tool_calls: int = 0

    def allow_step(self) -> bool:
        return self.steps < self.max_steps and now() - self.started < self.max_seconds

    def allow_tool(self) -> bool:
        return self.tool_calls < self.max_tool_calls and now() - self.started < self.max_seconds


@dataclass(slots=True)
class Belief:
    key: str
    value: str
    confidence: float
    evidence: Tuple[str, ...] = ()
    updated_at: float = field(default_factory=now)

    def update(self, signal: float, evidence: str, lr: float = 0.28) -> "Belief":
        c = clamp((1 - lr) * self.confidence + lr * signal)
        return Belief(self.key, self.value, c, self.evidence + (evidence,), now())


@dataclass(slots=True)
class Memory:
    id: str
    text: str
    kind: str
    importance: float
    confidence: float
    created_at: float
    last_used: float
    embedding_json: str

    @property
    def embedding(self) -> Dict[int, float]:
        return {int(k): float(v) for k, v in json.loads(self.embedding_json).items()}

    def utility(self) -> float:
        age = max(now() - self.last_used, 1.0)
        recency = 1.0 / math.log(age + 3)
        return 0.45 * self.importance + 0.35 * self.confidence + 0.20 * recency


@dataclass(slots=True)
class Thought:
    claim: str
    confidence: float
    risk: float
    value: float
    evidence: List[str] = field(default_factory=list)


@dataclass(slots=True)
class Action:
    name: str
    args: Dict[str, Any]
    expected_value: float
    cost: float
    risk: float

    @property
    def score(self) -> float:
        return self.expected_value - self.cost - self.risk
