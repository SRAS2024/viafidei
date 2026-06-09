"""
Adversarial self-testing — the brain attacks its own reasoning and safety gates.

It generates adversarial cases (a fake-official source, hidden separation
language, a duplicate with a different title, a saint with one wrong date, an
apparition with disputed status, a liturgical reading for the wrong year, …),
attacks a decision with them, finds reasoning weaknesses, hardens the rule, and
turns each exposed weakness into a regression-test request. Deterministic; TS
persists AdversarialCase + creates the regression request.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# Adversarial case library (the spec's 20), each with the gate it targets and
# the defense that should catch it.
_CASES: Dict[str, Dict[str, str]] = {
    "fake_official_source": {"target": "source_authority", "defense": "verify against the authority registry, not self-claim"},
    "hidden_separation_language": {"target": "communion_risk", "defense": "scan for separation markers even when buried"},
    "vatican_quote_false_interpretation": {"target": "claim_verification", "defense": "separate the quote from the interpretation"},
    "duplicate_different_title": {"target": "duplicate", "defense": "compare normalized body, not just titles"},
    "similar_vocab_distinct_prayers": {"target": "duplicate", "defense": "require high structural overlap, avoid false positive"},
    "saint_one_wrong_date": {"target": "claim_verification", "defense": "cross-source the feast day"},
    "apparition_disputed_status": {"target": "epistemic", "defense": "require human review on disputed approval"},
    "liturgical_wrong_year": {"target": "logic_rule", "defense": "validate against the calendar cycle/year"},
    "non_roman_catholic_parish": {"target": "communion_risk", "defense": "confirm full communion with Rome"},
    "broken_pdf_structure": {"target": "extraction", "defense": "route to OCR/review, do not fabricate fields"},
    "hidden_missing_citation": {"target": "completeness", "defense": "require citation presence explicitly"},
    "dynamic_low_text": {"target": "extraction", "defense": "detect under-rendered pages"},
    "route_exists_no_content": {"target": "route", "defense": "verify the route exposes the content"},
    "admin_correction_contradicts_memory": {"target": "memory", "defense": "reconcile, prefer the newer admin signal"},
    "weak_evidence_developer_request": {"target": "developer_request", "defense": "require evidence/area/severity/gain"},
    "passes_quality_fails_authority": {"target": "proof", "defense": "authority gate independent of quality"},
    "passes_authority_fails_completeness": {"target": "proof", "defense": "completeness gate independent of authority"},
    "near_duplicate_passes_checks": {"target": "duplicate", "defense": "lower the blocking threshold for near-dupes"},
    "popular_unsourced_claim": {"target": "epistemic", "defense": "popularity is not authority"},
    "high_confidence_needs_review": {"target": "review_gate", "defense": "sensitive types always route to review"},
}


def generate_adversarial_case(payload: Dict[str, Any]) -> Dict[str, Any]:
    target = str(opt(payload, "target", "") or "")
    cases = [{"name": n, **c} for n, c in _CASES.items() if (not target or c["target"] == target)]
    if not cases:
        cases = [{"name": n, **c} for n, c in _CASES.items()]
    return envelope(
        result={"cases": cases, "count": len(cases)},
        confidence=0.85, reasoning=f"Generated {len(cases)} adversarial case(s).",
        evidence=[c["name"] for c in cases[:5]], risk_level=RISK_NONE,
        recommended_next_action="attack-decision", safe_to_auto_execute=True,
    )


def attack_decision(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run an adversarial case against a decision; did the gate hold?"""
    case = str(require(payload, "case"))
    spec = _CASES.get(case, {"target": "unknown", "defense": "n/a"})
    # The decision is held to have a defense if it lists the targeted gate.
    defenses = {str(d) for d in (opt(payload, "active_defenses", []) or [])}
    held = spec["target"] in defenses
    return envelope(
        result={"case": case, "target_gate": spec["target"], "held": held,
                "expected_defense": spec["defense"]},
        confidence=0.82,
        reasoning=(f"Gate '{spec['target']}' held against '{case}'." if held
                   else f"WEAKNESS: '{case}' was not caught by gate '{spec['target']}'."),
        evidence=[f"target={spec['target']}", f"held={held}"],
        risk_level=RISK_NONE if held else RISK_HIGH,
        recommended_next_action="continue" if held else "create-regression-from-attack",
        safe_to_auto_execute=held,
    )


def find_reasoning_weakness(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Given the active defenses, list the adversarial cases NOT yet covered."""
    defenses = {str(d) for d in (opt(payload, "active_defenses", []) or [])}
    weaknesses = [{"case": n, "uncovered_gate": c["target"], "defense": c["defense"]}
                  for n, c in _CASES.items() if c["target"] not in defenses]
    return envelope(
        result={"weaknesses": weaknesses, "count": len(weaknesses)},
        confidence=0.8,
        reasoning=(f"{len(weaknesses)} adversarial case(s) not yet defended." if weaknesses
                   else "All adversarial gates covered."),
        evidence=[w["case"] for w in weaknesses[:5]] or ["robust"],
        risk_level=RISK_MEDIUM if weaknesses else RISK_NONE,
        recommended_next_action="harden-rule" if weaknesses else "robust",
        safe_to_auto_execute=True,
    )


def harden_rule(payload: Dict[str, Any]) -> Dict[str, Any]:
    case = str(require(payload, "case"))
    spec = _CASES.get(case, {"target": "unknown", "defense": "add a guard"})
    return envelope(
        result={"case": case, "gate": spec["target"], "hardening": spec["defense"],
                "review_required": True},
        confidence=0.8,
        reasoning=f"Harden '{spec['target']}': {spec['defense']} (review-gated).",
        evidence=[spec["defense"]], risk_level=RISK_LOW,
        recommended_next_action="create-regression-from-attack", safe_to_auto_execute=False,
    )


def create_regression_from_attack(payload: Dict[str, Any]) -> Dict[str, Any]:
    case = str(require(payload, "case"))
    spec = _CASES.get(case, {"target": "unknown", "defense": "n/a"})
    test = {
        "name": f"regression: {case}",
        "asserts": f"the {spec['target']} gate catches '{case}'",
        "expected_defense": spec["defense"],
        "review_required": True,
    }
    return envelope(
        result={"regression_request": test},
        confidence=0.85,
        reasoning=f"Created a regression-test request for '{case}'.",
        evidence=[test["asserts"]], risk_level=RISK_LOW,
        recommended_next_action="open-developer-request", safe_to_auto_execute=False,
    )
