"""
Duplicate detection.

Combines several deterministic signals — exact title/slug match, slug
similarity, fuzzy title distance, semantic (vector) overlap, alias
matches, source overlap and citation overlap — into a single duplicate
score per candidate. TypeScript enforces "duplicate detected, no publish"
using this; the brain only scores and explains.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from ..contracts import (
    RISK_HIGH,
    RISK_LOW,
    RISK_MEDIUM,
    RISK_NONE,
    envelope,
    opt,
    require,
)
from ..core import (
    clamp,
    cosine,
    jaccard,
    normalize_text,
    slugify,
    sparse_embed,
    str_ratio,
)

_HOST_RE = re.compile(r"^[a-z]+://([^/]+)/?", re.IGNORECASE)


def _host(value: str) -> str:
    """Reduce a URL to its host so two pages on the same site overlap."""
    m = _HOST_RE.match(value.strip())
    host = (m.group(1) if m else value).lower()
    return host[4:] if host.startswith("www.") else host


def _norm_set(values: Any) -> set:
    if not isinstance(values, list):
        return set()
    return {normalize_text(str(v)) for v in values if str(v).strip()}


def _source_set(values: Any) -> set:
    if not isinstance(values, list):
        return set()
    return {_host(str(v)) for v in values if str(v).strip()}


def _signals(target: Dict[str, Any], cand: Dict[str, Any], dims: int) -> Dict[str, float]:
    t_title = normalize_text(str(target.get("title") or ""))
    c_title = normalize_text(str(cand.get("title") or ""))
    t_slug = str(target.get("slug") or slugify(str(target.get("title") or "")))
    c_slug = str(cand.get("slug") or slugify(str(cand.get("title") or "")))

    exact = 1.0 if (t_title and t_title == c_title) or (t_slug and t_slug == c_slug) else 0.0
    slug_sim = str_ratio(t_slug, c_slug) if t_slug and c_slug else 0.0
    fuzzy_title = str_ratio(t_title, c_title) if t_title and c_title else 0.0

    t_text = str(target.get("text") or target.get("summary") or target.get("title") or "")
    c_text = str(cand.get("text") or cand.get("summary") or cand.get("title") or "")
    semantic = (
        cosine(sparse_embed(t_text, dims), sparse_embed(c_text, dims))
        if t_text.strip() and c_text.strip()
        else 0.0
    )

    t_alias = _norm_set(target.get("aliases")) | ({t_title} if t_title else set())
    c_alias = _norm_set(cand.get("aliases")) | ({c_title} if c_title else set())
    alias = 1.0 if (t_alias & c_alias) else jaccard(t_alias, c_alias)

    source_overlap = jaccard(_source_set(target.get("sources")), _source_set(cand.get("sources")))
    citation_overlap = jaccard(_source_set(target.get("citations")), _source_set(cand.get("citations")))

    return {
        "exact": exact,
        "slug": slug_sim,
        "fuzzy_title": fuzzy_title,
        "semantic": semantic,
        "alias": alias,
        "source_overlap": source_overlap,
        "citation_overlap": citation_overlap,
    }


def _combine(s: Dict[str, float]) -> float:
    if s["exact"] >= 1.0:
        return 1.0
    score = (
        0.32 * s["fuzzy_title"]
        + 0.20 * s["slug"]
        + 0.24 * s["semantic"]
        + 0.12 * s["alias"]
        + 0.06 * s["source_overlap"]
        + 0.06 * s["citation_overlap"]
    )
    if s["alias"] >= 1.0:  # a shared alias is strong evidence on its own
        score = max(score, 0.9)
    return clamp(score)


def _verdict(score: float) -> str:
    if score >= 0.92:
        return "duplicate"
    if score >= 0.8:
        return "likely-duplicate"
    if score >= 0.65:
        return "possible-duplicate"
    return "distinct"


def detect_duplicates(payload: Dict[str, Any]) -> Dict[str, Any]:
    target = require(payload, "target")
    candidates = require(payload, "candidates")
    if not isinstance(candidates, list):
        candidates = []
    dims = int(opt(payload, "dims", 512))
    dup_threshold = float(opt(payload, "duplicate_threshold", 0.85))

    results: List[Dict[str, Any]] = []
    for c in candidates:
        signals = _signals(target, c, dims)
        score = _combine(signals)
        results.append(
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "score": round(score, 4),
                "verdict": _verdict(score),
                "signals": {k: round(v, 4) for k, v in signals.items()},
            }
        )
    results.sort(key=lambda x: x["score"], reverse=True)
    best = results[0] if results else None
    best_score = best["score"] if best else 0.0
    is_duplicate = best_score >= dup_threshold

    if is_duplicate:
        risk = RISK_HIGH
        action = "block-as-duplicate"
    elif best_score >= 0.65:
        risk = RISK_MEDIUM
        action = "escalate-possible-duplicate"
    elif best_score > 0:
        risk = RISK_LOW
        action = "proceed-no-duplicate"
    else:
        risk = RISK_NONE
        action = "proceed-no-duplicate"

    reasons = []
    if best:
        sig = best["signals"]
        reasons = [f"{k}={v}" for k, v in sig.items() if v >= 0.5]
    return envelope(
        result={
            "is_duplicate": is_duplicate,
            "best_match": best,
            "matches": results[: int(opt(payload, "k", 10))],
            "duplicate_threshold": dup_threshold,
        },
        confidence=best_score if is_duplicate else clamp(1.0 - best_score),
        reasoning=(
            f"Top candidate scored {best_score:.2f} across exact/slug/fuzzy/semantic/"
            f"alias/source/citation signals (threshold {dup_threshold:.2f})."
            if best
            else "No candidates supplied; nothing to compare against."
        ),
        evidence=reasons or ["no strong duplicate signal"],
        sources_used=[str(best.get("id"))] if best and best.get("id") else [],
        risk_level=risk,
        recommended_next_action=action,
        # Auto-blocking a clear duplicate is safe; a borderline case is not.
        safe_to_auto_execute=is_duplicate and best_score >= 0.92,
    )
