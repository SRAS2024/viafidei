"""
Hybrid semantic search + memory/source/content retrieval.

Keeps deterministic sparse vectors as one component but blends in keyword
overlap, graph relationship, source authority, citation strength, freshness,
content-type, admin-feedback, and historical-success weighting. Pure + stdlib.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require
from ..core import clamp, cosine, sparse_embed, token_set, jaccard

_AUTHORITY_W = {"VATICAN": 1.0, "CATECHISM": 0.95, "LITURGICAL_BOOK": 0.9, "USCCB": 0.8,
                "DIOCESAN": 0.65, "RELIGIOUS_ORDER": 0.55, "TRUSTED_PUBLISHER": 0.5,
                "ACADEMIC": 0.45, "COMMUNITY": 0.3}


def _hybrid_score(query: str, qv, cand: Dict[str, Any], weights: Dict[str, float]) -> Dict[str, Any]:
    text = str(cand.get("text", cand.get("title", "")))
    sparse = cosine(qv, sparse_embed(text)) if query else 0.0
    keyword = jaccard(token_set(query), token_set(text)) if query else 0.0
    graph = float(cand.get("graph_relatedness", 0.0))
    authority = _AUTHORITY_W.get(str(cand.get("authorityLevel", "")).upper(), 0.0)
    citation = clamp(int(cand.get("citationCount", 0)) / 3)
    freshness = float(cand.get("freshness", 0.5))
    feedback = clamp(0.5 + float(cand.get("adminFeedback", 0.0)))
    success = float(cand.get("historicalSuccess", 0.5))
    parts = {
        "keyword": keyword * weights.get("keyword", 0.2),
        "sparse": sparse * weights.get("sparse", 0.25),
        "graph": graph * weights.get("graph", 0.1),
        "authority": authority * weights.get("authority", 0.15),
        "citation": citation * weights.get("citation", 0.08),
        "freshness": freshness * weights.get("freshness", 0.07),
        "feedback": feedback * weights.get("feedback", 0.08),
        "success": success * weights.get("success", 0.07),
    }
    return {
        "id": cand.get("id"),
        "score": round(clamp(sum(parts.values())), 4),
        "components": {k: round(v, 4) for k, v in parts.items()},
    }


def hybrid_search(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank candidates by a blended hybrid score; explain the top components."""
    query = str(opt(payload, "query", ""))
    cands = [c for c in (require(payload, "candidates") or []) if isinstance(c, dict)]
    weights = opt(payload, "weights", {}) or {}
    k = int(opt(payload, "k", 10))
    qv = sparse_embed(query) if query else {}
    scored = [_hybrid_score(query, qv, c, weights) for c in cands]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return envelope(
        result={"matches": scored[:k], "considered": len(cands), "query": query},
        confidence=0.78 if cands else 0.3,
        reasoning=f"Hybrid search over {len(cands)} candidate(s); top score {scored[0]['score'] if scored else 0}.",
        evidence=[f"{m['id']}: {m['score']}" for m in scored[:6]] or ["no candidates"],
        risk_level=RISK_NONE,
        recommended_next_action="use-top-matches",
    )


def rank_memory_candidates(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _ranked(payload, {"sparse": 0.3, "keyword": 0.3, "success": 0.2, "feedback": 0.2}, "memory")


def rank_source_candidates(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _ranked(payload, {"authority": 0.4, "success": 0.2, "freshness": 0.2, "citation": 0.2}, "source")


def rank_related_content(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _ranked(payload, {"sparse": 0.3, "keyword": 0.2, "graph": 0.3, "authority": 0.2}, "related-content")


def _ranked(payload: Dict[str, Any], weights: Dict[str, float], label: str) -> Dict[str, Any]:
    query = str(opt(payload, "query", ""))
    cands = [c for c in (require(payload, "candidates") or []) if isinstance(c, dict)]
    qv = sparse_embed(query) if query else {}
    scored = sorted((_hybrid_score(query, qv, c, weights) for c in cands), key=lambda x: x["score"], reverse=True)
    return envelope(
        result={"ranked": scored, "top": scored[0] if scored else None},
        confidence=0.76 if cands else 0.3,
        reasoning=f"Ranked {len(cands)} {label} candidate(s).",
        evidence=[f"{m['id']}: {m['score']}" for m in scored[:6]] or ["none"],
        risk_level=RISK_NONE,
        recommended_next_action=f"use-top-{label}",
    )


def explain_retrieval_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain why a retrieval result ranked where it did (component breakdown)."""
    result = require(payload, "result")
    comps = result.get("components", {})
    top = sorted(comps.items(), key=lambda kv: kv[1], reverse=True)
    lines = [f"{k} contributed {v}" for k, v in top]
    return envelope(
        result={"explanation": lines, "dominant": top[0][0] if top else None},
        confidence=0.8,
        reasoning=f"Top driver: {top[0][0] if top else 'n/a'}.",
        evidence=lines[:6] or ["no components"],
        risk_level=RISK_NONE,
        recommended_next_action="retrieval-explained",
    )


def detect_memory_gap(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Detect when retrieval found nothing relevant for a query (a memory gap)."""
    query = str(require(payload, "query"))
    cands = [c for c in (opt(payload, "candidates", []) or []) if isinstance(c, dict)]
    qv = sparse_embed(query)
    best = max((cosine(qv, sparse_embed(str(c.get("text", c.get("title", ""))))) for c in cands), default=0.0)
    gap = best < float(opt(payload, "min_similarity", 0.15))
    return envelope(
        result={"memory_gap": gap, "best_similarity": round(best, 3), "query": query},
        confidence=0.75 if cands else 0.5,
        reasoning=(f"Memory gap: nothing relevant for '{query}' (best {round(best,2)})." if gap else "Relevant memory exists."),
        evidence=[f"best similarity {round(best,3)}"],
        risk_level=RISK_LOW if gap else RISK_NONE,
        recommended_next_action="acquire-knowledge" if gap else "context-available",
    )
