"""
Highest-leverage change ranking — the single most valuable improvement now.

The brain doesn't merely list everything it wants; it ranks interventions
(new parser, schema field, source rule, test, ontology relation, route, admin
control, quality gate, proof rule, duplicate rule, repair strategy, benchmark
case, adversarial test, mission priority, extraction path) by value ÷ cost and
explains why the top one wins. Deterministic over the candidate interventions
TypeScript supplies (or a default set).
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require

# Default intervention priors: (value 0..1, cost 0..1, what it unblocks).
_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "new_parser": {"value": 0.8, "cost": 0.6, "unblocks": "extraction of a stuck source class"},
    "new_schema_field": {"value": 0.6, "cost": 0.5, "unblocks": "repeated admin corrections"},
    "new_source_rule": {"value": 0.5, "cost": 0.3, "unblocks": "source authority consistency"},
    "new_test": {"value": 0.5, "cost": 0.2, "unblocks": "regression protection"},
    "new_ontology_relation": {"value": 0.4, "cost": 0.3, "unblocks": "content structure"},
    "new_route": {"value": 0.7, "cost": 0.3, "unblocks": "invisible content"},
    "new_admin_control": {"value": 0.4, "cost": 0.4, "unblocks": "operator oversight"},
    "new_quality_gate": {"value": 0.6, "cost": 0.4, "unblocks": "low-quality publishes"},
    "new_proof_rule": {"value": 0.7, "cost": 0.4, "unblocks": "unsafe sensitive publishes"},
    "new_duplicate_rule": {"value": 0.6, "cost": 0.4, "unblocks": "near-duplicate leakage"},
    "new_repair_strategy": {"value": 0.6, "cost": 0.5, "unblocks": "repeated repair failure"},
    "new_benchmark_case": {"value": 0.4, "cost": 0.2, "unblocks": "blind spots"},
    "new_adversarial_test": {"value": 0.5, "cost": 0.3, "unblocks": "reasoning weaknesses"},
    "new_mission_priority": {"value": 0.5, "cost": 0.2, "unblocks": "mission stagnation"},
    "new_extraction_path": {"value": 0.7, "cost": 0.6, "unblocks": "format coverage"},
}


def _candidates(payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    supplied = opt(payload, "interventions", None)
    if isinstance(supplied, dict) and supplied:
        return {k: dict(v) for k, v in supplied.items() if isinstance(v, dict)}
    if isinstance(supplied, list) and supplied:
        out = {}
        for item in supplied:
            if isinstance(item, dict) and item.get("name"):
                out[str(item["name"])] = item
        if out:
            return out
    return dict(_DEFAULTS)


def _leverage(spec: Dict[str, Any]) -> float:
    value = float(spec.get("value", 0.5))
    cost = max(0.1, float(spec.get("cost", 0.5)))
    return round(value / cost, 3)


def estimate_intervention_value(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(require(payload, "name"))
    spec = _candidates(payload).get(name, _DEFAULTS.get(name, {"value": 0.5, "cost": 0.5}))
    return envelope(
        result={"name": name, "value": float(spec.get("value", 0.5)),
                "cost": float(spec.get("cost", 0.5)), "leverage": _leverage(spec),
                "unblocks": spec.get("unblocks", "")},
        confidence=0.8, reasoning=f"'{name}' leverage {_leverage(spec)}.",
        evidence=[f"leverage={_leverage(spec)}"], risk_level=RISK_NONE,
        recommended_next_action="rank-highest-leverage-change", safe_to_auto_execute=True,
    )


def compare_intervention_costs(payload: Dict[str, Any]) -> Dict[str, Any]:
    cands = _candidates(payload)
    by_cost = sorted(({"name": n, "cost": float(s.get("cost", 0.5)), "value": float(s.get("value", 0.5))}
                      for n, s in cands.items()), key=lambda d: d["cost"])
    return envelope(
        result={"by_cost": by_cost, "cheapest": by_cost[0]["name"] if by_cost else None},
        confidence=0.8,
        reasoning=(f"Cheapest: {by_cost[0]['name']} (cost {by_cost[0]['cost']})." if by_cost else "none"),
        evidence=[f"{d['name']}={d['cost']}" for d in by_cost[:4]], risk_level=RISK_NONE,
        recommended_next_action="rank-highest-leverage-change", safe_to_auto_execute=True,
    )


def rank_highest_leverage_change(payload: Dict[str, Any]) -> Dict[str, Any]:
    cands = _candidates(payload)
    ranked = sorted(({"name": n, "leverage": _leverage(s), "value": float(s.get("value", 0.5)),
                      "cost": float(s.get("cost", 0.5)), "unblocks": s.get("unblocks", "")}
                     for n, s in cands.items()), key=lambda d: d["leverage"], reverse=True)
    top = ranked[0] if ranked else None
    return envelope(
        result={"ranked": ranked, "highest_leverage": top["name"] if top else None,
                "single_most_valuable": top},
        confidence=0.85,
        reasoning=(f"Highest-leverage change: {top['name']} (leverage {top['leverage']}) — "
                   f"unblocks {top['unblocks']}." if top else "no interventions"),
        evidence=[f"{d['name']}={d['leverage']}" for d in ranked[:4]],
        risk_level=RISK_LOW, recommended_next_action="explain-highest-leverage-change",
        safe_to_auto_execute=True,
    )


def explain_highest_leverage_change(payload: Dict[str, Any]) -> Dict[str, Any]:
    ranked = rank_highest_leverage_change(payload)["result"]
    top = ranked.get("single_most_valuable")
    if not top:
        return envelope(result={"explanation": "no interventions"}, confidence=0.4,
                        reasoning="none", risk_level=RISK_NONE,
                        recommended_next_action="gather-interventions", safe_to_auto_execute=True)
    expl = (f"'{top['name']}' is the single highest-leverage change: value {top['value']} at cost "
            f"{top['cost']} (leverage {top['leverage']}), unblocking {top['unblocks']}. It is "
            "evidence-based and, if it touches code/schema, routed through human review.")
    return envelope(
        result={"name": top["name"], "explanation": expl, "leverage": top["leverage"],
                "review_required": True},
        confidence=0.85, reasoning=expl, evidence=[f"leverage={top['leverage']}"],
        risk_level=RISK_LOW, recommended_next_action="open-developer-request",
        safe_to_auto_execute=False,
    )
