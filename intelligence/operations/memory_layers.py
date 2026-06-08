"""
Multi-layer memory operations.

Memory is no longer a single outcome log: it is organised into layers (episodic,
semantic, procedural, source, self, admin-feedback, mission, safety) and the
brain actively consolidates, dedupes, reconciles, retires, ranks, and retrieves
it. Pure + stdlib; reasons over memory records TypeScript supplies from Postgres.

A memory record: {id, layer, text, importance, confidence, created_at,
last_used, kind}.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require
from ..core import clamp, jaccard, token_set, sparse_embed, cosine

MEMORY_LAYERS = [
    "episodic", "semantic", "procedural", "source", "self", "admin_feedback", "mission", "safety",
]


def _mems(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    m = require(payload, "memories")
    return [x for x in m if isinstance(x, dict)] if isinstance(m, list) else []


def _importance(m: Dict[str, Any]) -> float:
    age = max(time.time() - float(m.get("last_used", m.get("created_at", time.time()))), 1.0)
    recency = 1.0 / (1.0 + age / 86400.0)  # per-day decay
    return clamp(0.45 * float(m.get("importance", 0.5)) + 0.35 * float(m.get("confidence", 0.5)) + 0.20 * recency)


def consolidate_memories(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Group memories by layer + summarise counts and top items per layer."""
    mems = _mems(payload)
    by_layer: Dict[str, List[Dict[str, Any]]] = {}
    for m in mems:
        by_layer.setdefault(str(m.get("layer", m.get("kind", "episodic"))), []).append(m)
    summary = {
        layer: {
            "count": len(items),
            "top": sorted((str(i.get("text", ""))[:80] for i in items), key=len, reverse=True)[:3],
        }
        for layer, items in by_layer.items()
    }
    return envelope(
        result={"by_layer": summary, "layer_count": len(by_layer), "total": len(mems)},
        confidence=0.8 if mems else 0.3,
        reasoning=f"Consolidated {len(mems)} memories across {len(by_layer)} layer(s).",
        evidence=[f"{k}:{v['count']}" for k, v in summary.items()][:8] or ["no memories"],
        risk_level=RISK_NONE,
        recommended_next_action="rank-memory-importance",
    )


def summarize_repeated_lessons(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Cluster memories by text overlap and surface the repeated lessons."""
    mems = _mems(payload)
    sigs = [(m, token_set(str(m.get("text", "")))) for m in mems if str(m.get("text", ""))]
    clusters: List[Dict[str, Any]] = []
    used = [False] * len(sigs)
    for i in range(len(sigs)):
        if used[i]:
            continue
        group = [sigs[i][0]]
        for j in range(i + 1, len(sigs)):
            if not used[j] and jaccard(sigs[i][1], sigs[j][1]) >= 0.5:
                used[j] = True
                group.append(sigs[j][0])
        used[i] = True
        if len(group) >= 2:
            clusters.append({"lesson": str(group[0].get("text", ""))[:120], "occurrences": len(group)})
    clusters.sort(key=lambda c: c["occurrences"], reverse=True)
    return envelope(
        result={"lessons": clusters, "count": len(clusters)},
        confidence=0.75 if mems else 0.3,
        reasoning=f"{len(clusters)} repeated lesson(s) found.",
        evidence=[f"{c['lesson']} (×{c['occurrences']})" for c in clusters[:5]] or ["no repeats"],
        risk_level=RISK_NONE,
        recommended_next_action="reinforce-lessons",
    )


def merge_duplicate_memories(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Identify near-duplicate memories to merge (by text Jaccard)."""
    mems = _mems(payload)
    threshold = float(opt(payload, "threshold", 0.7))
    sigs = [(m, token_set(str(m.get("text", "")))) for m in mems]
    merges: List[Dict[str, Any]] = []
    used = [False] * len(sigs)
    for i in range(len(sigs)):
        if used[i]:
            continue
        dupes = []
        for j in range(i + 1, len(sigs)):
            if not used[j] and jaccard(sigs[i][1], sigs[j][1]) >= threshold:
                used[j] = True
                dupes.append(sigs[j][0].get("id"))
        used[i] = True
        if dupes:
            merges.append({"keep": sigs[i][0].get("id"), "merge": dupes})
    return envelope(
        result={"merges": merges, "merge_count": len(merges)},
        confidence=0.75 if mems else 0.3,
        reasoning=f"{len(merges)} memory merge group(s).",
        evidence=[f"keep {m['keep']} ← {len(m['merge'])}" for m in merges[:5]] or ["no duplicates"],
        risk_level=RISK_NONE,
        recommended_next_action="apply-memory-merges",
    )


def detect_conflicting_memories(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Find memories with the same key but opposite signal/value."""
    mems = _mems(payload)
    by_key: Dict[str, List[Dict[str, Any]]] = {}
    for m in mems:
        by_key.setdefault(str(m.get("key", m.get("memoryKey", ""))), []).append(m)
    conflicts = []
    for key, group in by_key.items():
        if not key:
            continue
        signals = {round(float(m.get("signal", 0.0)), 1) for m in group if "signal" in m}
        if len(signals) > 1 and (max(signals) - min(signals)) >= 0.6:
            conflicts.append({"key": key, "signals": sorted(signals)})
    return envelope(
        result={"conflicts": conflicts, "count": len(conflicts)},
        confidence=0.75 if mems else 0.3,
        reasoning=f"{len(conflicts)} conflicting memory key(s).",
        evidence=[f"{c['key']}: {c['signals']}" for c in conflicts[:5]] or ["no conflicts"],
        risk_level=RISK_LOW if conflicts else RISK_NONE,
        recommended_next_action="reconcile-memories" if conflicts else "memories-consistent",
    )


def retire_stale_memories(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Recommend retiring low-importance, long-unused memories."""
    mems = _mems(payload)
    max_age_days = float(opt(payload, "max_age_days", 90))
    now = time.time()
    stale = [
        m.get("id")
        for m in mems
        if (now - float(m.get("last_used", m.get("created_at", now)))) / 86400.0 > max_age_days
        and float(m.get("importance", 0.5)) < 0.4
    ]
    return envelope(
        result={"retire": stale, "retire_count": len(stale)},
        confidence=0.75 if mems else 0.3,
        reasoning=f"{len(stale)} stale, low-importance memory(ies) to retire.",
        evidence=[str(s) for s in stale[:8]] or ["nothing stale"],
        risk_level=RISK_NONE,
        recommended_next_action="retire-memories" if stale else "memory-fresh",
    )


def rank_memory_importance(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank memories by a recency/importance/confidence utility."""
    mems = _mems(payload)
    ranked = sorted(
        ({"id": m.get("id"), "text": str(m.get("text", ""))[:80], "utility": round(_importance(m), 3)} for m in mems),
        key=lambda x: x["utility"],
        reverse=True,
    )
    return envelope(
        result={"ranked": ranked[:50], "count": len(ranked)},
        confidence=0.8 if mems else 0.3,
        reasoning=f"Ranked {len(ranked)} memory(ies) by utility.",
        evidence=[f"{r['id']}: {r['utility']}" for r in ranked[:6]] or ["no memories"],
        risk_level=RISK_NONE,
        recommended_next_action="retrieve-context-pack",
    )


def retrieve_context_pack(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieve the most relevant memories for a query (importance × similarity)."""
    mems = _mems(payload)
    query = str(opt(payload, "query", ""))
    k = int(opt(payload, "k", 8))
    qv = sparse_embed(query) if query else {}
    scored = []
    for m in mems:
        sim = cosine(qv, sparse_embed(str(m.get("text", "")))) if query else 0.0
        score = clamp(0.6 * sim + 0.4 * _importance(m))
        scored.append({"id": m.get("id"), "layer": m.get("layer"), "text": str(m.get("text", ""))[:120], "score": round(score, 3)})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return envelope(
        result={"context_pack": scored[:k], "query": query},
        confidence=0.78 if mems else 0.3,
        reasoning=f"Retrieved {min(k, len(scored))} memory(ies) for the query.",
        evidence=[f"{r['id']}: {r['score']}" for r in scored[:6]] or ["no memories"],
        risk_level=RISK_NONE,
        recommended_next_action="use-context-before-decision",
    )


def extract_upgrade_requests_from_memory(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Turn recurring self/feedback memories into upgrade-request seeds."""
    mems = _mems(payload)
    seeds = []
    for m in mems:
        layer = str(m.get("layer", ""))
        if layer in ("self", "admin_feedback") and float(m.get("importance", 0)) >= 0.5:
            seeds.append(
                {
                    "title": str(m.get("text", ""))[:80],
                    "kind": "capability" if layer == "self" else "data",
                    "evidence": str(m.get("text", ""))[:160],
                    "occurrences": int(m.get("occurrences", 1) or 1),
                }
            )
    return envelope(
        result={"upgrade_seeds": seeds, "count": len(seeds)},
        confidence=0.72 if mems else 0.3,
        reasoning=f"Extracted {len(seeds)} upgrade-request seed(s) from memory.",
        evidence=[s["title"] for s in seeds[:6]] or ["no upgrade seeds"],
        risk_level=RISK_NONE,
        recommended_next_action="rank-upgrade-requests",
        safe_to_auto_execute=False,
    )
