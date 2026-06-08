"""
Upgrade-request engine — the worker's internal product manager.

Ranks, explains, dedupes, and ROI-scores the worker's developer/upgrade
requests so it can say what it needs, why, how much it helps, and what evidence
supports it. Deterministic + stdlib; reasons over request records TypeScript
supplies from Postgres.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require
from ..core import clamp, jaccard, token_set

_DIFFICULTY = {"low": 0.25, "medium": 0.55, "high": 0.85}
_SEVERITY = {"low": 0.3, "medium": 0.6, "high": 0.9}


def _roi(req: Dict[str, Any]) -> float:
    gain = float(req.get("expected_gain", _SEVERITY.get(str(req.get("severity", "medium")).lower(), 0.6)))
    occurrences = int(req.get("occurrences", 1) or 1)
    difficulty = _DIFFICULTY.get(str(req.get("difficulty", "medium")).lower(), 0.55)
    # ROI: value (gain × how often it bites) over cost (difficulty).
    return clamp((gain * (1.0 + 0.1 * min(occurrences, 10))) / (0.3 + difficulty), 0.0, 1.0)


def rank_upgrade_requests(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank requests by priority = severity × occurrences × ROI."""
    reqs = [r for r in (require(payload, "requests") or []) if isinstance(r, dict)]
    ranked = []
    for r in reqs:
        sev = _SEVERITY.get(str(r.get("severity", "medium")).lower(), 0.6)
        occ = int(r.get("occurrences", 1) or 1)
        roi = _roi(r)
        priority = clamp(0.5 * sev + 0.2 * min(occ / 10, 1.0) + 0.3 * roi)
        ranked.append(
            {
                "title": r.get("title"),
                "kind": r.get("kind"),
                "severity": r.get("severity"),
                "occurrences": occ,
                "roi": round(roi, 3),
                "priority_score": round(priority, 3),
            }
        )
    ranked.sort(key=lambda x: x["priority_score"], reverse=True)
    return envelope(
        result={"ranked": ranked, "top": ranked[0] if ranked else None},
        confidence=0.82 if reqs else 0.3,
        reasoning=f"Ranked {len(ranked)} upgrade request(s) by priority.",
        evidence=[f"{r['title']}: {r['priority_score']}" for r in ranked[:6]] or ["no requests"],
        risk_level=RISK_NONE,
        recommended_next_action="act-on-top-upgrade" if ranked else "no-upgrades",
        safe_to_auto_execute=False,
    )


def explain_upgrade_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Expand a request into the full PM brief."""
    r = require(payload, "request")
    brief = {
        "title": r.get("title"),
        "category": r.get("kind", r.get("category")),
        "problem": r.get("detail", r.get("problem", "")),
        "evidence": r.get("evidence", ""),
        "expected_intelligence_gain": r.get("expected_gain", "improves reliability"),
        "expected_user_value": r.get("user_value", "more complete, accurate content"),
        "risk_if_not_fixed": r.get("risk_if_not_fixed", "recurring failures persist"),
        "implementation_difficulty": r.get("difficulty", "medium"),
        "suggested_tests": r.get("suggested_tests", "add a regression test for the failure"),
        "rollback_plan": r.get("rollback_plan", "revert the commit; no data migration"),
        "priority_score": round(clamp(_SEVERITY.get(str(r.get("severity", "medium")).lower(), 0.6)), 3),
        "confidence_score": round(float(r.get("confidence", 0.7)), 3),
    }
    return envelope(
        result={"brief": brief},
        confidence=0.8,
        reasoning=f"Expanded upgrade request '{brief['title']}' into a full brief.",
        evidence=[str(brief["problem"])[:120]],
        risk_level=RISK_NONE,
        recommended_next_action="review-brief",
        safe_to_auto_execute=False,
    )


def merge_duplicate_upgrade_requests(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Merge near-duplicate requests by title/detail overlap."""
    reqs = [r for r in (require(payload, "requests") or []) if isinstance(r, dict)]
    threshold = float(opt(payload, "threshold", 0.6))
    merged: List[Dict[str, Any]] = []
    used = [False] * len(reqs)
    for i, r in enumerate(reqs):
        if used[i]:
            continue
        sig = token_set(f"{r.get('title','')} {r.get('detail', r.get('problem',''))}")
        group = [i]
        for j in range(i + 1, len(reqs)):
            if used[j]:
                continue
            sig2 = token_set(f"{reqs[j].get('title','')} {reqs[j].get('detail', reqs[j].get('problem',''))}")
            if jaccard(sig, sig2) >= threshold:
                used[j] = True
                group.append(j)
        used[i] = True
        merged.append(
            {
                "title": r.get("title"),
                "merged_count": len(group),
                "occurrences": sum(int(reqs[k].get("occurrences", 1) or 1) for k in group),
            }
        )
    return envelope(
        result={"merged": merged, "original_count": len(reqs), "merged_count": len(merged)},
        confidence=0.75 if reqs else 0.3,
        reasoning=f"Merged {len(reqs)} request(s) into {len(merged)} unique upgrade(s).",
        evidence=[f"{m['title']} (×{m['merged_count']})" for m in merged[:6]] or ["no requests"],
        risk_level=RISK_NONE,
        recommended_next_action="dedup-applied",
    )


def detect_ignored_upgrade_requests(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Flag high-priority requests that keep recurring but are never acted on."""
    reqs = [r for r in (require(payload, "requests") or []) if isinstance(r, dict)]
    ignored = [
        {"title": r.get("title"), "occurrences": int(r.get("occurrences", 1) or 1), "age_days": int(r.get("age_days", 0) or 0)}
        for r in reqs
        if int(r.get("occurrences", 1) or 1) >= 5
        and str(r.get("status", "open")).lower() in ("open", "bumped", "pending")
    ]
    ignored.sort(key=lambda x: (x["occurrences"], x["age_days"]), reverse=True)
    return envelope(
        result={"ignored": ignored, "count": len(ignored)},
        confidence=0.8 if reqs else 0.3,
        reasoning=f"{len(ignored)} recurring upgrade request(s) appear unaddressed.",
        evidence=[f"{r['title']} (×{r['occurrences']})" for r in ignored[:6]] or ["none ignored"],
        risk_level=RISK_LOW if ignored else RISK_NONE,
        recommended_next_action="surface-ignored-upgrades" if ignored else "all-addressed",
    )


def estimate_upgrade_roi(payload: Dict[str, Any]) -> Dict[str, Any]:
    """ROI for a single request (value/cost)."""
    r = require(payload, "request")
    roi = _roi(r)
    return envelope(
        result={"roi": round(roi, 3), "title": r.get("title")},
        confidence=0.75,
        reasoning=f"Estimated ROI {round(roi, 3)} for '{r.get('title')}'.",
        evidence=[f"difficulty={r.get('difficulty', 'medium')}", f"occurrences={r.get('occurrences', 1)}"],
        risk_level=RISK_NONE,
        recommended_next_action="prioritize-by-roi",
    )
