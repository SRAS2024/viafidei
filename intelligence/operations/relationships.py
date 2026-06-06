"""
Relationship inference.

Recommends edges between a record and candidate records using semantic
similarity plus shared categories, names, dates and citations. It only
*recommends* — TypeScript validates and persists approved relationships,
and the brain never fabricates a relationship it has no signal for.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import clamp, cosine, jaccard, normalize_text, sparse_embed, token_set

_YEAR_RE = re.compile(r"\b(\d{3,4})\b")


def _set(values: Any) -> set:
    if not isinstance(values, list):
        return set()
    return {normalize_text(str(v)) for v in values if str(v).strip()}


def _years(record: Dict[str, Any]) -> set:
    blob = " ".join(str(record.get(k) or "") for k in ("text", "title", "summary"))
    explicit = _set(record.get("dates"))
    return explicit | set(_YEAR_RE.findall(blob))


def _type_hint(a_type: str, b_type: str, score: float) -> str:
    a, b = a_type.upper(), b_type.upper()
    people = {"SAINT", "POPE", "DOCTOR"}
    works = {"PRAYER", "NOVENA", "CHURCH_DOCUMENT", "DEVOTION", "LITANY"}
    if a in people and b in works:
        return "ASSOCIATED_WITH"
    if a in works and b in people:
        return "ASSOCIATED_WITH"
    if a == b and score >= 0.82:
        return "STRONGLY_RELATED"
    return "RELATED_TO"


def infer_relationships(payload: Dict[str, Any]) -> Dict[str, Any]:
    record = require(payload, "record")
    candidates = require(payload, "candidates")
    if not isinstance(candidates, list):
        candidates = []
    max_out = int(opt(payload, "max", 10))

    r_text = str(record.get("text") or record.get("summary") or record.get("title") or "")
    r_vec = sparse_embed(r_text)
    r_cats = _set(record.get("categories"))
    r_names = _set(record.get("names"))
    r_years = _years(record)
    r_cites = _set(record.get("citations")) | _set(record.get("sources"))
    r_type = str(record.get("contentType") or "")

    recs: List[Dict[str, Any]] = []
    for c in candidates:
        if c.get("id") is not None and c.get("id") == record.get("id"):
            continue
        c_text = str(c.get("text") or c.get("summary") or c.get("title") or "")
        semantic = cosine(r_vec, sparse_embed(c_text)) if r_text and c_text else 0.0
        cat_overlap = jaccard(r_cats, _set(c.get("categories")))
        name_overlap = jaccard(r_names, _set(c.get("names")))
        year_overlap = 1.0 if (r_years & _years(c)) else 0.0
        cite_overlap = jaccard(r_cites, _set(c.get("citations")) | _set(c.get("sources")))
        title_overlap = jaccard(token_set(str(record.get("title") or "")), token_set(str(c.get("title") or "")))

        score = clamp(
            0.40 * semantic
            + 0.16 * cat_overlap
            + 0.16 * name_overlap
            + 0.10 * year_overlap
            + 0.10 * cite_overlap
            + 0.08 * title_overlap
        )
        if score < 0.25:
            continue
        signals = {
            "semantic": round(semantic, 3),
            "category_overlap": round(cat_overlap, 3),
            "name_overlap": round(name_overlap, 3),
            "year_overlap": year_overlap,
            "citation_overlap": round(cite_overlap, 3),
            "title_overlap": round(title_overlap, 3),
        }
        recs.append(
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "score": round(score, 4),
                "type_hint": _type_hint(r_type, str(c.get("contentType") or ""), score),
                "signals": signals,
                "rationale": "; ".join(f"{k}={v}" for k, v in signals.items() if v and v >= 0.3)
                or "weak-but-present overlap",
            }
        )

    recs.sort(key=lambda x: x["score"], reverse=True)
    recs = recs[:max_out]
    best = recs[0]["score"] if recs else 0.0
    strong = [r for r in recs if r["score"] >= 0.6]

    return envelope(
        result={"recommendations": recs, "strong_count": len(strong)},
        confidence=best,
        reasoning=(
            f"Recommended {len(recs)} relationship(s) from {len(candidates)} candidate(s); "
            f"{len(strong)} with score >= 0.60."
        ),
        evidence=[f"{r['title']}: {r['rationale']}" for r in recs[:3]] or ["no candidate met the floor"],
        risk_level=RISK_LOW if recs else RISK_NONE,
        recommended_next_action="persist-strong-relationships-after-review" if strong else "review-suggestions",
        # Even strong suggestions get a human check before persistence by default.
        safe_to_auto_execute=False,
    )
