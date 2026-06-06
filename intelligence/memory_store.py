"""
intelligence.memory_store — the brain's working memory (ported).

This is the sqlite-backed semantic memory from the operator-provided
script. In the integrated worker, Postgres is the canonical long-term
store and TypeScript owns all writes; this store is used for:

  * the standalone Brain demo / CLI (``python3 -m intelligence.brain``),
  * unit tests, and
  * an optional in-process scratch cache (path ``":memory:"``).

It is deliberately kept close to the original so the reasoning loop in
``intelligence.brain`` behaves exactly as designed.
"""

from __future__ import annotations

import heapq
import json
import uuid
from typing import List, Tuple

from .core import Belief, Memory, clamp, cosine, now, sparse_embed

try:  # sqlite3 is stdlib but guard anyway so import never hard-fails.
    import sqlite3
except Exception:  # pragma: no cover - sqlite3 is always present in CPython
    sqlite3 = None  # type: ignore[assignment]


class MemoryStore:
    def __init__(self, path: str = ":memory:") -> None:
        if sqlite3 is None:  # pragma: no cover
            raise RuntimeError("sqlite3 unavailable")
        self.db = sqlite3.connect(path)
        self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                kind TEXT NOT NULL,
                importance REAL NOT NULL,
                confidence REAL NOT NULL,
                created_at REAL NOT NULL,
                last_used REAL NOT NULL,
                embedding_json TEXT NOT NULL
            )
            """
        )
        self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS beliefs (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                confidence REAL NOT NULL,
                evidence_json TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
            """
        )
        self.db.commit()

    def remember(
        self,
        text: str,
        kind: str = "fact",
        importance: float = 0.6,
        confidence: float = 0.7,
    ) -> str:
        mid = str(uuid.uuid4())
        emb = json.dumps(sparse_embed(text), separators=(",", ":"))
        t = now()
        self.db.execute(
            "INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (mid, text, kind, clamp(importance), clamp(confidence), t, t, emb),
        )
        self.db.commit()
        return mid

    def recall(self, query: str, k: int = 8) -> List[Memory]:
        q = sparse_embed(query)
        rows = self.db.execute("SELECT * FROM memories").fetchall()
        scored: List[Tuple[float, Memory]] = []
        for r in rows:
            m = Memory(*r)
            score = 0.72 * cosine(q, m.embedding) + 0.28 * m.utility()
            scored.append((score, m))
        best = heapq.nlargest(k, scored, key=lambda x: x[0])
        ids = [(now(), m.id) for _, m in best]
        self.db.executemany("UPDATE memories SET last_used=? WHERE id=?", ids)
        self.db.commit()
        return [m for _, m in best]

    def believe(self, key: str, value: str, confidence: float, evidence: str) -> None:
        old = self.db.execute("SELECT * FROM beliefs WHERE key=?", (key,)).fetchone()
        if old:
            b = Belief(old[0], old[1], old[2], tuple(json.loads(old[3])), old[4])
            b = b.update(confidence, evidence)
        else:
            b = Belief(key, value, clamp(confidence), (evidence,), now())
        self.db.execute(
            "REPLACE INTO beliefs VALUES (?, ?, ?, ?, ?)",
            (b.key, b.value, b.confidence, json.dumps(b.evidence), b.updated_at),
        )
        self.db.commit()

    def compress(self, keep: int = 2000) -> None:
        rows = self.db.execute("SELECT * FROM memories").fetchall()
        memories = [Memory(*r) for r in rows]
        memories.sort(key=lambda m: m.utility(), reverse=True)
        remove = memories[keep:]
        self.db.executemany(
            "DELETE FROM memories WHERE id=?", [(m.id,) for m in remove]
        )
        self.db.commit()
