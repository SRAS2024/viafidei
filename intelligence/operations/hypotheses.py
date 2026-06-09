"""
Hypothesis engine — the brain forms, ranks, tests, and evaluates explanations
for why the worker is succeeding or failing.

Each hypothesis carries evidence, confidence, an expected result, a bounded
experiment plan, and success criteria. Deterministic: a template library keyed
to observed symptoms, instantiated against the signals TypeScript supplies.
TypeScript persists Hypothesis rows + their evaluation.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# symptom key → hypothesis template (statement, expected_result, experiment, criteria, impact)
_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "church_document_stuck": {
        "statement": "Church-document growth is stuck because document metadata extraction is incomplete.",
        "expected_result": "Adding a document-metadata extractor raises CHURCH_DOCUMENT publish rate.",
        "experiment": "Compare extraction completeness on 5 Vatican documents with vs without the metadata path.",
        "criteria": "publish rate +20% on the test set", "impact": 0.8},
    "saint_quality_low": {
        "statement": "Saint biography quality is low because sources are secondary instead of official.",
        "expected_result": "Preferring official sources raises the saint quality score.",
        "experiment": "Build 5 saints from official vs 5 from secondary sources; compare quality.",
        "criteria": "official group quality +0.1", "impact": 0.7},
    "duplicate_translations": {
        "statement": "Duplicate detection is missing translated variants.",
        "expected_result": "A translation-variant detector raises duplicate recall without false positives.",
        "experiment": "Run duplicate detection on known translated pairs with vs without the variant rule.",
        "criteria": "recall +0.2, false-positive rate unchanged", "impact": 0.7},
    "liturgical_failing": {
        "statement": "Liturgical content is failing because calendar-year context is missing.",
        "expected_result": "Supplying calendar context lets liturgical content validate.",
        "experiment": "Validate 5 liturgical items with vs without calendar context.",
        "criteria": "validation pass rate +30%", "impact": 0.75},
    "parish_discovery_weak": {
        "statement": "Parish discovery is weak because diocesan source structure varies too much.",
        "expected_result": "A per-diocese directory adapter raises parish discovery yield.",
        "experiment": "Compare discovery yield on 3 dioceses with vs without per-structure adapters.",
        "criteria": "yield +25%", "impact": 0.6},
    "developer_request_repeating": {
        "statement": "Developer requests repeat because the same schema gap stays unresolved.",
        "expected_result": "Closing the schema gap stops the repeating request.",
        "experiment": "Track request recurrence before vs after a schema migration (review-gated).",
        "criteria": "request stops recurring", "impact": 0.8},
    "repair_low": {
        "statement": "Repair success is low because repair plans are not source-class specific.",
        "expected_result": "Source-class-specific repair raises repair success rate.",
        "experiment": "Compare generic vs source-class repair on 5 failed artifacts each.",
        "criteria": "repair success +20%", "impact": 0.7},
    "admin_corrections_high": {
        "statement": "Admin corrections are high because quality scoring underweights citation depth.",
        "expected_result": "Weighting citation depth reduces admin corrections.",
        "experiment": "Compare correction rate before vs after the scoring change on new content.",
        "criteria": "corrections -20%", "impact": 0.65},
}


def _detect_symptoms(signals: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    if not isinstance(signals, dict):
        return out
    def hot(k: str) -> bool:
        try:
            return float(signals.get(k, 0)) > 0
        except (TypeError, ValueError):
            return bool(signals.get(k))
    if hot("church_document_gap"): out.append("church_document_stuck")
    if hot("saint_quality_low"): out.append("saint_quality_low")
    if hot("duplicate_misses"): out.append("duplicate_translations")
    if hot("liturgical_failures"): out.append("liturgical_failing")
    if hot("parish_discovery_low"): out.append("parish_discovery_weak")
    if hot("repeating_developer_requests"): out.append("developer_request_repeating")
    if hot("repair_failures"): out.append("repair_low")
    if hot("admin_corrections"): out.append("admin_corrections_high")
    return out


def _build(key: str, signals: Dict[str, Any]) -> Dict[str, Any]:
    t = _TEMPLATES[key]
    return {
        "key": key,
        "statement": t["statement"],
        "evidence": [f"signal:{key}"],
        "confidence": round(0.5 + 0.1 * t["impact"], 3),
        "expected_result": t["expected_result"],
        "experiment_plan": t["experiment"],
        "success_criteria": t["criteria"],
        "impact": t["impact"],
        "status": "PROPOSED",
    }


def generate_hypothesis(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Generate hypotheses for the observed symptoms (or all if none given)."""
    signals = opt(payload, "signals", {}) or {}
    keys = _detect_symptoms(signals) or list(_TEMPLATES.keys())
    hyps = [_build(k, signals) for k in keys]
    return envelope(
        result={"hypotheses": hyps, "count": len(hyps)},
        confidence=0.78,
        reasoning=f"Generated {len(hyps)} hypothesis(es) from the signals.",
        evidence=[h["key"] for h in hyps[:5]],
        risk_level=RISK_NONE,
        recommended_next_action="rank-hypotheses",
        safe_to_auto_execute=True,
    )


def rank_hypotheses(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank hypotheses by confidence x impact (the test-worth)."""
    hyps = [h for h in (require(payload, "hypotheses")) if isinstance(h, dict)]
    for h in hyps:
        h["priority"] = round(float(h.get("confidence", 0.5)) * float(h.get("impact", 0.5)), 3)
    hyps.sort(key=lambda h: h["priority"], reverse=True)
    return envelope(
        result={"ranked": hyps, "top": hyps[0]["key"] if hyps else None},
        confidence=0.8,
        reasoning=(f"Top hypothesis: {hyps[0].get('statement', hyps[0].get('key', '?'))}"
                   if hyps else "No hypotheses."),
        evidence=[f"{h['key']}={h['priority']}" for h in hyps[:4]],
        risk_level=RISK_NONE,
        recommended_next_action="test-hypothesis",
        safe_to_auto_execute=True,
    )


def test_hypothesis(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Attach the bounded experiment that would test a hypothesis."""
    hyp = require(payload, "hypothesis")
    if not isinstance(hyp, dict):
        return envelope(result={"testable": False}, confidence=0.4,
                        reasoning="hypothesis is not an object.", risk_level=RISK_LOW,
                        recommended_next_action="generate-hypothesis", safe_to_auto_execute=True)
    return envelope(
        result={"testable": True, "key": hyp.get("key"),
                "experiment_plan": hyp.get("experiment_plan"),
                "success_criteria": hyp.get("success_criteria"), "status": "TESTING"},
        confidence=0.78,
        reasoning=f"Testing via: {hyp.get('experiment_plan')}",
        evidence=[f"criteria={hyp.get('success_criteria')}"],
        risk_level=RISK_LOW,
        recommended_next_action="run-experiment-plan",
        safe_to_auto_execute=True,
    )


def evaluate_hypothesis_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Compare the observed result against the hypothesis's expectation."""
    hyp = require(payload, "hypothesis")
    observed = require(payload, "observed")  # {met_criteria: bool, [effect: float]}
    met = bool(observed.get("met_criteria")) if isinstance(observed, dict) else bool(observed)
    verdict = "SUPPORTED" if met else "NOT_SUPPORTED"
    return envelope(
        result={"key": (hyp or {}).get("key") if isinstance(hyp, dict) else None,
                "verdict": verdict, "met_criteria": met},
        confidence=0.8,
        reasoning=f"Hypothesis {verdict.lower().replace('_', ' ')} by the observed result.",
        evidence=[f"met_criteria={met}"],
        risk_level=RISK_NONE,
        recommended_next_action="accept-or-reject-hypothesis",
        safe_to_auto_execute=True,
    )


def accept_or_reject_hypothesis(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Accept or reject based on the verdict + confidence threshold."""
    verdict = str(require(payload, "verdict")).upper()
    confidence = float(opt(payload, "confidence", 0.7))
    accepted = verdict == "SUPPORTED" and confidence >= 0.6
    return envelope(
        result={"decision": "ACCEPTED" if accepted else "REJECTED", "verdict": verdict},
        confidence=max(confidence, 0.6),
        reasoning=("Accepted: supported with adequate confidence." if accepted
                   else "Rejected: not supported or confidence too low."),
        evidence=[f"verdict={verdict}", f"confidence={confidence}"],
        risk_level=RISK_NONE,
        recommended_next_action="store-hypothesis-lesson" if accepted else "generate-hypothesis",
        safe_to_auto_execute=True,
    )


def store_hypothesis_lesson(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Turn an accepted hypothesis into a reusable lesson (TS persists)."""
    hyp = require(payload, "hypothesis")
    if not isinstance(hyp, dict):
        return envelope(result={"lesson": None}, confidence=0.4,
                        reasoning="hypothesis is not an object.", risk_level=RISK_LOW,
                        recommended_next_action="generate-hypothesis", safe_to_auto_execute=True)
    lesson = f"Confirmed: {hyp.get('statement')} → {hyp.get('expected_result')}"
    return envelope(
        result={"lesson": lesson, "key": hyp.get("key"), "impact": hyp.get("impact")},
        confidence=0.8,
        reasoning=lesson,
        evidence=[f"impact={hyp.get('impact')}"],
        risk_level=RISK_NONE,
        recommended_next_action="store-lesson",
        safe_to_auto_execute=True,
    )
