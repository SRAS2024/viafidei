"""
Epistemic status — how certain, supported, disputed, or risky a claim is.

The worker never treats all extracted facts equally. Every claim is assigned a
status (Certain → Well supported → Likely → Uncertain → Conflicting → Needs more
evidence → Requires human review → Blocked) from its authority, sources,
citations, agreements, conflicts, and confidence. Deterministic; TS persists
ClaimRecord + EpistemicStatusHistory.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import (
    RISK_CRITICAL,
    RISK_HIGH,
    RISK_LOW,
    RISK_MEDIUM,
    RISK_NONE,
    envelope,
    opt,
    require,
)

STATUSES = ["CERTAIN", "WELL_SUPPORTED", "LIKELY", "UNCERTAIN", "CONFLICTING",
            "NEEDS_MORE_EVIDENCE", "REQUIRES_HUMAN_REVIEW", "BLOCKED"]

_AUTHORITY = ["COMMUNITY", "ACADEMIC", "TRUSTED_PUBLISHER", "RELIGIOUS_ORDER",
              "DIOCESAN", "USCCB", "LITURGICAL", "CATECHISM", "VATICAN"]

_SENSITIVE = {"DOCTRINE", "SACRAMENT", "CHURCH_DOCUMENT", "CATECHISM", "CANON_LAW",
              "PAPAL_DOCUMENT", "COUNCIL", "LITURGICAL", "APPARITION", "POPE"}


def _rank(level: str) -> int:
    try:
        return _AUTHORITY.index(str(level).upper())
    except ValueError:
        return -1


def _claim(payload: Dict[str, Any]) -> Dict[str, Any]:
    c = opt(payload, "claim", {}) or {}
    return {
        "text": c.get("text", ""),
        "subject": c.get("subject", ""),
        "predicate": c.get("predicate", ""),
        "value": c.get("value", ""),
        "source": c.get("source", ""),
        "authority": str(c.get("authority", c.get("authorityLevel", ""))).upper(),
        "sources": int(c.get("sourceCount", len(c.get("sources", []) or []))),
        "citations": int(c.get("citationCount", len(c.get("citations", []) or []))),
        "agreements": int(c.get("agreements", 0) or 0),
        "conflicts": list(c.get("conflicts", []) or []),
        "confidence": float(c.get("confidence", 0.5) or 0.5),
        "contentType": str(c.get("contentType", "")).upper(),
    }


def _status(c: Dict[str, Any]) -> Dict[str, Any]:
    sensitive = c["contentType"] in _SENSITIVE
    auth = _rank(c["authority"])
    why: List[str] = []

    if c["conflicts"]:
        status = "BLOCKED" if sensitive else "CONFLICTING"
        why.append(f"{len(c['conflicts'])} unresolved conflict(s)")
    elif c["sources"] == 0 and c["citations"] == 0:
        status = "NEEDS_MORE_EVIDENCE"
        why.append("no source or citation")
    elif auth >= _rank("VATICAN") and c["citations"] >= 1:
        status = "CERTAIN"
        why.append("Vatican-level authority + citation")
    elif auth >= _rank("USCCB") and c["agreements"] >= 1 and c["citations"] >= 1:
        status = "WELL_SUPPORTED"
        why.append("high authority + agreement + citation")
    elif auth >= _rank("TRUSTED_PUBLISHER") and c["citations"] >= 1:
        status = "LIKELY"
        why.append("trusted source + citation")
    else:
        status = "UNCERTAIN"
        why.append("weak authority or missing citation")

    # Sensitive claims below Vatican authority always require human review.
    review = sensitive and status not in ("BLOCKED",) and auth < _rank("VATICAN")
    if review and status in ("LIKELY", "UNCERTAIN", "WELL_SUPPORTED"):
        status = "REQUIRES_HUMAN_REVIEW"
        why.append("sensitive type below Vatican authority")

    risk = {"BLOCKED": RISK_CRITICAL, "CONFLICTING": RISK_HIGH,
            "REQUIRES_HUMAN_REVIEW": RISK_MEDIUM, "NEEDS_MORE_EVIDENCE": RISK_MEDIUM,
            "UNCERTAIN": RISK_MEDIUM, "LIKELY": RISK_LOW, "WELL_SUPPORTED": RISK_LOW,
            "CERTAIN": RISK_NONE}.get(status, RISK_MEDIUM)
    would_change = []
    if status in ("UNCERTAIN", "LIKELY", "NEEDS_MORE_EVIDENCE"):
        would_change.append("an independent higher-authority corroborating source")
    if status in ("REQUIRES_HUMAN_REVIEW",):
        would_change.append("a Vatican-level source or human approval")
    if status in ("CONFLICTING", "BLOCKED"):
        would_change.append("resolution of the contradiction in favour of the higher authority")
    return {
        "status": status, "risk_level": risk, "why": why,
        "review_required": status in ("REQUIRES_HUMAN_REVIEW", "BLOCKED") or review,
        "what_would_change": would_change,
        "authority": c["authority"], "confidence": c["confidence"],
    }


def assign_epistemic_status(payload: Dict[str, Any]) -> Dict[str, Any]:
    c = _claim(payload)
    s = _status(c)
    return envelope(
        result={"claim": c["text"] or c, "epistemic_status": s["status"],
                "review_required": s["review_required"], "why": s["why"],
                "what_would_change": s["what_would_change"]},
        confidence=0.85,
        reasoning=f"Status {s['status']}: {'; '.join(s['why'])}.",
        evidence=[f"authority={c['authority'] or 'none'}", f"citations={c['citations']}",
                  f"conflicts={len(c['conflicts'])}"],
        risk_level=s["risk_level"],
        recommended_next_action=("require-more-evidence" if s["status"] == "NEEDS_MORE_EVIDENCE"
                                 else "route-to-review" if s["review_required"] else "accept-claim"),
        safe_to_auto_execute=s["status"] in ("CERTAIN", "WELL_SUPPORTED") and not s["review_required"],
    )


def update_epistemic_status(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Recompute status after new evidence is merged into the claim."""
    return assign_epistemic_status(payload)


def explain_uncertainty(payload: Dict[str, Any]) -> Dict[str, Any]:
    c = _claim(payload)
    s = _status(c)
    return envelope(
        result={"status": s["status"], "explanation": "; ".join(s["why"]),
                "what_would_change": s["what_would_change"]},
        confidence=0.8,
        reasoning="; ".join(s["why"]),
        evidence=s["what_would_change"] or ["no missing evidence"],
        risk_level=s["risk_level"],
        recommended_next_action="require-more-evidence",
        safe_to_auto_execute=True,
    )


def detect_overconfidence(payload: Dict[str, Any]) -> Dict[str, Any]:
    """High stated confidence but a weak epistemic status = overconfidence."""
    c = _claim(payload)
    s = _status(c)
    weak = s["status"] in ("UNCERTAIN", "NEEDS_MORE_EVIDENCE", "CONFLICTING", "REQUIRES_HUMAN_REVIEW", "BLOCKED")
    overconfident = c["confidence"] >= 0.8 and weak
    return envelope(
        result={"overconfident": overconfident, "stated_confidence": c["confidence"],
                "epistemic_status": s["status"]},
        confidence=0.8,
        reasoning=(f"Overconfident: stated {c['confidence']} but status {s['status']}." if overconfident
                   else "Confidence is consistent with the evidence."),
        evidence=[f"status={s['status']}", f"confidence={c['confidence']}"],
        risk_level=RISK_MEDIUM if overconfident else RISK_NONE,
        recommended_next_action="cap-confidence" if overconfident else "continue",
        safe_to_auto_execute=not overconfident,
    )


def require_more_evidence(payload: Dict[str, Any]) -> Dict[str, Any]:
    c = _claim(payload)
    s = _status(c)
    needs = s["status"] in ("UNCERTAIN", "NEEDS_MORE_EVIDENCE", "LIKELY", "REQUIRES_HUMAN_REVIEW")
    return envelope(
        result={"needs_more_evidence": needs, "missing": s["what_would_change"]},
        confidence=0.8,
        reasoning=("More evidence needed: " + "; ".join(s["what_would_change"]) if needs
                   else "Sufficient evidence."),
        evidence=s["what_would_change"] or ["sufficient"],
        risk_level=RISK_MEDIUM if needs else RISK_NONE,
        recommended_next_action="fetch-corroborating-source" if needs else "accept-claim",
        safe_to_auto_execute=not needs,
    )


def rank_claim_certainty(payload: Dict[str, Any]) -> Dict[str, Any]:
    claims = [c for c in (require(payload, "claims")) if isinstance(c, dict)]
    order = {st: i for i, st in enumerate(STATUSES)}
    scored = []
    for raw in claims:
        c = _claim({"claim": raw})
        s = _status(c)
        scored.append({"claim": c["text"] or raw.get("subject", "?"),
                       "epistemic_status": s["status"], "rank": order.get(s["status"], 99)})
    scored.sort(key=lambda d: d["rank"])
    return envelope(
        result={"ranked": scored, "most_certain": scored[0] if scored else None},
        confidence=0.8,
        reasoning=(f"Most certain: {scored[0]['claim']} ({scored[0]['epistemic_status']})." if scored
                   else "No claims."),
        evidence=[f"{d['epistemic_status']}" for d in scored[:5]],
        risk_level=RISK_NONE,
        recommended_next_action="publish-certain-first",
        safe_to_auto_execute=True,
    )
