"""
Embeddings + semantic (vector) search.

``embed`` turns text into deterministic sparse vectors TypeScript stores
as JSON in Postgres (the semantic-memory / vector store). ``semantic_search``
ranks candidate records against a query so the worker can find related
content, duplicate candidates and conceptual overlap even when the wording
differs.
"""

from __future__ import annotations

from typing import Any, Dict

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require
from ..core import cosine, embed_from_json, embed_to_json, sparse_embed, token_set, tokenize


def _vector_for(item: Dict[str, Any], dims: int) -> Dict[int, float]:
    """Use a precomputed embedding if supplied, else embed the text."""
    raw = item.get("embedding_json")
    if isinstance(raw, str) and raw:
        try:
            return embed_from_json(raw)
        except Exception:  # noqa: BLE001 - fall back to fresh embedding
            pass
    emb = item.get("embedding")
    if isinstance(emb, dict):
        try:
            return {int(k): float(v) for k, v in emb.items()}
        except Exception:  # noqa: BLE001
            pass
    text = str(item.get("text") or item.get("title") or "")
    return sparse_embed(text, dims)


def embed(payload: Dict[str, Any]) -> Dict[str, Any]:
    items = require(payload, "items")
    dims = int(opt(payload, "dims", 512))
    if not isinstance(items, list):
        items = []
    vectors = []
    nonempty = 0
    for it in items:
        text = str(it.get("text") or it.get("title") or "")
        vec = sparse_embed(text, dims)
        if vec:
            nonempty += 1
        vectors.append(
            {
                "id": it.get("id"),
                "embedding_json": embed_to_json(vec),
                "dims": dims,
                "term_count": len(tokenize(text)),
            }
        )
    conf = (nonempty / len(items)) if items else 0.0
    return envelope(
        result={"vectors": vectors, "dims": dims, "count": len(vectors)},
        confidence=conf,
        reasoning=f"Embedded {len(vectors)} item(s) into {dims}-dim deterministic sparse vectors.",
        evidence=[f"{nonempty}/{len(items)} item(s) had embeddable text"]
        if items
        else ["no items supplied"],
        risk_level=RISK_NONE,
        recommended_next_action="store-embeddings",
    )


def semantic_search(payload: Dict[str, Any]) -> Dict[str, Any]:
    query = str(require(payload, "query"))
    candidates = require(payload, "candidates")
    if not isinstance(candidates, list):
        candidates = []
    k = int(opt(payload, "k", 8))
    min_sim = float(opt(payload, "min_similarity", 0.0))
    dims = int(opt(payload, "dims", 512))

    q = sparse_embed(query, dims)
    q_tokens = token_set(query)
    scored = []
    for c in candidates:
        vec = _vector_for(c, dims)
        sim = cosine(q, vec)
        if sim < min_sim:
            continue
        text = str(c.get("text") or c.get("title") or "")
        shared = sorted(q_tokens & token_set(text))[:8]
        scored.append(
            {
                "id": c.get("id"),
                "similarity": round(sim, 4),
                "shared_terms": shared,
                "preview": text[:160],
                "explanation": f"cosine {sim:.2f}; shares {len(shared)} key term(s)",
            }
        )
    scored.sort(key=lambda x: x["similarity"], reverse=True)
    top = scored[:k]
    best = top[0]["similarity"] if top else 0.0
    return envelope(
        result={"matches": top, "query": query, "considered": len(candidates)},
        confidence=best,
        reasoning=(
            f"Ranked {len(top)} of {len(candidates)} candidate(s) by deterministic "
            "cosine similarity over hashed bag-of-words vectors."
        ),
        evidence=[m["explanation"] for m in top[:3]] or ["no candidate cleared the threshold"],
        risk_level=RISK_LOW,
        recommended_next_action="review-top-matches" if top else "no-related-records-found",
    )
