"""
Richer self-explanation — make every decision auditable.

Deterministic + stdlib. Turns a decision record (chosen action, alternatives,
evidence, memories, source reputation, stage outcomes, risks) into a clear
narrative a developer or admin can follow.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require


def explain_decision(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Full narrative for a decision: what, why, evidence, memories, risks."""
    d = require(payload, "decision")
    chosen = str(d.get("selectedAction") or d.get("missionStage") or "action")
    lines: List[str] = [f"Chose: {chosen} ({d.get('missionStage', '')})."]
    if d.get("reasoning"):
        lines.append(f"Why: {d['reasoning']}")
    if d.get("evidenceUsed"):
        lines.append(f"Evidence: {', '.join(map(str, d['evidenceUsed'][:6]))}")
    if d.get("memoriesUsed"):
        lines.append(f"Memories used: {', '.join(map(str, d['memoriesUsed'][:6]))}")
    if d.get("sourceReputationUsed"):
        lines.append(f"Source reputation: {', '.join(map(str, d['sourceReputationUsed'][:6]))}")
    if d.get("stageOutcomesUsed"):
        lines.append(f"Stage outcomes: {', '.join(map(str, d['stageOutcomesUsed'][:6]))}")
    if d.get("safetyNotes"):
        lines.append(f"Safety: {', '.join(map(str, d['safetyNotes'][:4]))}")
    rejected = d.get("rejectedAlternatives") or []
    if rejected:
        lines.append(f"Rejected {len(rejected)} alternative(s).")
    return envelope(
        result={"explanation": lines, "chosen": chosen},
        confidence=float(d.get("confidenceScore", 0.7)),
        reasoning="Explained the decision with its evidence, memories, and safety basis.",
        evidence=lines[:6],
        risk_level=RISK_NONE,
        recommended_next_action="decision-explained",
    )


def explain_rejected_alternatives(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain why each alternative lost to the chosen action."""
    chosen_score = float(opt(payload, "chosen_score", 0.7))
    alts = [a for a in (require(payload, "alternatives") or []) if isinstance(a, dict)]
    lines = []
    for a in alts[:8]:
        score = float(a.get("finalScore", a.get("final_score", 0.0)))
        reason = a.get("rejectedReason") or a.get("rejected_reason") or "lower expected value"
        lines.append(
            f"{a.get('missionStage', a.get('mission_stage', 'alt'))} (score {round(score, 2)} < {round(chosen_score, 2)}): {reason}."
        )
    return envelope(
        result={"explanations": lines, "count": len(alts)},
        confidence=0.8 if alts else 0.4,
        reasoning=f"Explained {len(alts)} rejected alternative(s).",
        evidence=lines[:6] or ["no alternatives"],
        risk_level=RISK_NONE,
        recommended_next_action="alternatives-explained",
    )


def explain_safety_gate(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain whether/why a decision is safe to auto-execute."""
    risk = str(opt(payload, "risk_level", "low"))
    confidence = float(opt(payload, "confidence", 0.7))
    sensitive = bool(opt(payload, "sensitive", False))
    notes = [str(n) for n in (opt(payload, "safety_notes", []) or [])]
    safe = confidence >= 0.75 and risk in ("none", "low") and not sensitive
    reason = (
        "safe to auto-execute: high confidence, low risk, not doctrinally sensitive"
        if safe
        else f"route to review: risk={risk}, confidence={round(confidence, 2)}"
        + (", doctrinally sensitive" if sensitive else "")
    )
    return envelope(
        result={"safe": safe, "reason": reason, "notes": notes},
        confidence=0.85,
        reasoning=reason,
        evidence=notes[:4] or [f"risk={risk}", f"confidence={round(confidence, 2)}"],
        risk_level=RISK_LOW if safe else RISK_NONE,
        recommended_next_action="auto-execute" if safe else "human-review",
        safe_to_auto_execute=safe,
    )


def explain_confidence(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain what drives a confidence score up or down."""
    confidence = float(require(payload, "confidence"))
    drivers = [str(x) for x in (opt(payload, "drivers", []) or [])]
    band = "high" if confidence >= 0.75 else "moderate" if confidence >= 0.5 else "low"
    return envelope(
        result={"confidence": confidence, "band": band, "drivers": drivers},
        confidence=0.8,
        reasoning=f"Confidence is {band} ({round(confidence, 2)}).",
        evidence=drivers[:6] or [f"{band} confidence"],
        risk_level=RISK_NONE,
        recommended_next_action="confidence-explained",
    )


def explain_what_would_change_my_mind(payload: Dict[str, Any]) -> Dict[str, Any]:
    """State the concrete evidence that would flip the decision."""
    decision = str(opt(payload, "decision", "the chosen action"))
    factors = [str(x) for x in (opt(payload, "deciding_factors", []) or [])]
    flips: List[str] = []
    for f in factors[:6]:
        flips.append(f"If '{f}' changed, the decision could flip.")
    if not flips:
        flips = [
            "A higher-authority source contradicting the chosen value.",
            "A new duplicate match above threshold.",
            "A safety/communion-risk flag on the source.",
            "Stage success-rate dropping below the threshold.",
        ]
    return envelope(
        result={"would_change_my_mind": flips, "decision": decision},
        confidence=0.75,
        reasoning=f"Listed {len(flips)} factor(s) that would change the decision.",
        evidence=flips[:5],
        risk_level=RISK_NONE,
        recommended_next_action="watch-deciding-factors",
    )
