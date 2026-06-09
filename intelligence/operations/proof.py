"""
Proof packets — evidence-based proof for sensitive/important decisions.

Instead of trusting a confidence score, the brain assembles a proof packet: the
claim, the source/authority/citation/agreement/conflict evidence, the required
conditions, which are satisfied vs failed, the risk, the recommended action,
whether human review is required, and what evidence would change the decision.
Deterministic over the evidence TypeScript supplies; TS persists ProofPacket and
enforces the outcome at the publish gate.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_CRITICAL, RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# Authority ladder (higher index = stronger), mirrors authority.py.
_AUTHORITY = ["COMMUNITY", "ACADEMIC", "TRUSTED_PUBLISHER", "RELIGIOUS_ORDER",
              "DIOCESAN", "USCCB", "LITURGICAL", "CATECHISM", "VATICAN"]

# Content categories that require proof-based publishing (the spec's list).
SENSITIVE_TYPES = {
    "DOCTRINE", "SACRAMENT", "CHURCH_DOCUMENT", "CATECHISM", "CANON_LAW",
    "PAPAL_DOCUMENT", "COUNCIL", "LITURGICAL", "LITURGICAL_CALENDAR", "APPARITION",
    "MARIAN_TITLE", "DEVOTION", "CHURCH_HISTORY", "SCHISM", "HERESY", "POPE",
}


def _authority_rank(level: str) -> int:
    try:
        return _AUTHORITY.index(str(level).upper())
    except ValueError:
        return -1


def _evidence(payload: Dict[str, Any]) -> Dict[str, Any]:
    ev = opt(payload, "evidence", {}) or {}
    return {
        "sources": list(ev.get("sources", []) or []),
        "authorities": [str(a).upper() for a in (ev.get("authorities", []) or [])],
        "citations": list(ev.get("citations", []) or []),
        "agreements": int(ev.get("agreements", 0) or 0),
        "conflicts": list(ev.get("conflicts", []) or []),
    }


def _evaluate(payload: Dict[str, Any]) -> Dict[str, Any]:
    claim = opt(payload, "claim", {}) or {}
    content_type = str(opt(payload, "content_type", claim.get("contentType", ""))).upper()
    sensitive = bool(opt(payload, "sensitive", content_type in SENSITIVE_TYPES))
    ev = _evidence(payload)

    best_authority = max((_authority_rank(a) for a in ev["authorities"]), default=-1)
    min_authority = _authority_rank("USCCB") if sensitive else _authority_rank("TRUSTED_PUBLISHER")

    conditions = [
        {"id": "source_support", "ok": len(ev["sources"]) >= (2 if sensitive else 1),
         "need": f"≥{2 if sensitive else 1} supporting source(s)"},
        {"id": "authority", "ok": best_authority >= min_authority,
         "need": f"authority ≥ {_AUTHORITY[min_authority]}"},
        {"id": "citations", "ok": len(ev["citations"]) >= 1, "need": "≥1 valid citation"},
        {"id": "no_unresolved_conflict", "ok": len(ev["conflicts"]) == 0,
         "need": "no unresolved contradiction"},
    ]
    if sensitive:
        conditions.append({"id": "agreement", "ok": ev["agreements"] >= 1,
                           "need": "≥1 independent agreement"})

    failed = [c for c in conditions if not c["ok"]]
    satisfied = [c for c in conditions if c["ok"]]

    if not failed:
        risk = RISK_LOW if not sensitive else RISK_MEDIUM
        action = "publish"
        review = sensitive and best_authority < _authority_rank("VATICAN")
    elif any(c["id"] in ("no_unresolved_conflict", "authority") for c in failed):
        risk = RISK_HIGH if sensitive else RISK_MEDIUM
        action = "block" if any(c["id"] == "no_unresolved_conflict" for c in failed) else "review"
        review = True
    else:
        risk = RISK_MEDIUM
        action = "review"
        review = True

    would_change = [c["need"] for c in failed] or (
        ["a Vatican-level corroborating source"] if review else [])

    return {
        "claim": claim.get("text") or claim,
        "content_type": content_type,
        "sensitive": sensitive,
        "source_evidence": ev["sources"],
        "authority_evidence": ev["authorities"],
        "citation_evidence": ev["citations"],
        "agreement_evidence": ev["agreements"],
        "conflict_evidence": ev["conflicts"],
        "required_conditions": [c["need"] for c in conditions],
        "conditions_satisfied": [c["id"] for c in satisfied],
        "conditions_failed": [c["id"] for c in failed],
        "risk_level": risk,
        "recommended_action": action,
        "human_review_required": bool(review),
        "what_would_change": would_change,
        "proven": action == "publish",
    }


def build_proof_packet(payload: Dict[str, Any]) -> Dict[str, Any]:
    p = _evaluate(payload)
    return envelope(
        result=p,
        confidence=0.85 if p["proven"] else 0.6,
        reasoning=(f"Proof {'holds' if p['proven'] else 'incomplete'}: "
                   f"{len(p['conditions_satisfied'])} satisfied, {len(p['conditions_failed'])} failed; "
                   f"action={p['recommended_action']}."),
        evidence=[f"failed={p['conditions_failed']}", f"risk={p['risk_level']}"],
        risk_level=p["risk_level"],
        recommended_next_action=p["recommended_action"],
        safe_to_auto_execute=p["proven"] and not p["human_review_required"],
    )


def prove_claim_support(payload: Dict[str, Any]) -> Dict[str, Any]:
    p = _evaluate(payload)
    supported = "source_support" not in p["conditions_failed"] and "citations" not in p["conditions_failed"]
    return envelope(
        result={"supported": supported, "conditions_failed": p["conditions_failed"]},
        confidence=0.8 if supported else 0.55,
        reasoning="Claim has source + citation support." if supported else "Claim lacks adequate support.",
        evidence=[f"sources={len(p['source_evidence'])}", f"citations={len(p['citation_evidence'])}"],
        risk_level=RISK_LOW if supported else RISK_MEDIUM,
        recommended_next_action="build-proof-packet",
        safe_to_auto_execute=True,
    )


def prove_publish_eligibility(payload: Dict[str, Any]) -> Dict[str, Any]:
    p = _evaluate(payload)
    return envelope(
        result={"eligible": p["recommended_action"] == "publish",
                "human_review_required": p["human_review_required"],
                "conditions_failed": p["conditions_failed"], "risk_level": p["risk_level"]},
        confidence=0.85 if p["proven"] else 0.6,
        reasoning=("Eligible to publish." if p["recommended_action"] == "publish"
                   else f"Not eligible: {p['recommended_action']} ({p['conditions_failed']})."),
        evidence=[f"action={p['recommended_action']}"],
        risk_level=p["risk_level"],
        recommended_next_action=p["recommended_action"],
        safe_to_auto_execute=p["proven"] and not p["human_review_required"],
    )


def prove_block_reason(payload: Dict[str, Any]) -> Dict[str, Any]:
    p = _evaluate(payload)
    blocked = p["recommended_action"] == "block"
    reasons = p["conditions_failed"] if blocked else []
    return envelope(
        result={"blocked": blocked, "reasons": reasons, "conflict_evidence": p["conflict_evidence"]},
        confidence=0.85 if blocked else 0.7,
        reasoning=(f"Blocked: {reasons}." if blocked else "Not blocked."),
        evidence=[f"conflicts={len(p['conflict_evidence'])}"],
        risk_level=p["risk_level"] if blocked else RISK_LOW,
        recommended_next_action="resolve-conflict" if blocked else "continue",
        safe_to_auto_execute=True,
    )


def prove_review_requirement(payload: Dict[str, Any]) -> Dict[str, Any]:
    p = _evaluate(payload)
    return envelope(
        result={"human_review_required": p["human_review_required"], "sensitive": p["sensitive"],
                "reason": p["conditions_failed"] or (["sensitive type below Vatican authority"]
                                                     if p["human_review_required"] else [])},
        confidence=0.85,
        reasoning=("Human review required." if p["human_review_required"] else "No review required."),
        evidence=[f"sensitive={p['sensitive']}"],
        risk_level=RISK_MEDIUM if p["human_review_required"] else RISK_LOW,
        recommended_next_action="route-to-review" if p["human_review_required"] else "auto-eligible",
        safe_to_auto_execute=not p["human_review_required"],
    )


def explain_failed_proof(payload: Dict[str, Any]) -> Dict[str, Any]:
    p = _evaluate(payload)
    if p["proven"]:
        return envelope(result={"failed": False, "explanation": "The proof holds; no failure to explain."},
                        confidence=0.85, reasoning="Proof holds.", risk_level=RISK_LOW,
                        recommended_next_action="publish", safe_to_auto_execute=True)
    explanation = ("The proof is incomplete because: "
                   + "; ".join(f"{c}" for c in p["conditions_failed"])
                   + ". It would hold given: " + "; ".join(p["what_would_change"]) + ".")
    return envelope(
        result={"failed": True, "conditions_failed": p["conditions_failed"],
                "what_would_change": p["what_would_change"], "explanation": explanation},
        confidence=0.8,
        reasoning=explanation,
        evidence=[f"failed={p['conditions_failed']}"],
        risk_level=p["risk_level"],
        recommended_next_action="gather-missing-evidence",
        safe_to_auto_execute=False,
    )
