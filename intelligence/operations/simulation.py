"""
Action simulation — estimate likely outcomes before the worker acts.

For each candidate action the brain estimates expected value, failure
probability, publish/safety/source risk, repair + time cost, likely next stage
and blocker, and whether the action moves the mission forward — then explains
which action is best and what would happen for each. Deterministic + stdlib;
estimates come from supplied stage-outcome history + source reputation.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..contracts import risk_from_score
from ..core import clamp

# Stage → the stage that typically follows in the artifact chain.
_NEXT_STAGE = {
    "DISCOVERY": "CANDIDATE_PRIORITIZATION",
    "CANDIDATE_PRIORITIZATION": "SOURCE_FETCH",
    "SOURCE_FETCH": "SOURCE_READ",
    "SOURCE_READ": "CLASSIFICATION",
    "CLASSIFICATION": "EXTRACTION",
    "EXTRACTION": "CROSS_SOURCE_VERIFICATION",
    "CROSS_SOURCE_VERIFICATION": "STRICT_QA",
    "STRICT_QA": "PUBLIC_PUBLISH",
    "PUBLIC_PUBLISH": "POST_PUBLISH_VERIFY",
}


def _stage_success(history: List[Dict[str, Any]], stage: str) -> float:
    rows = [h for h in history if str(h.get("stage")) == stage]
    if not rows:
        return 0.6  # neutral prior
    rates = [float(h.get("successRate", h.get("success_rate", 0.6))) for h in rows]
    return clamp(sum(rates) / len(rates))


def _source_risk(reps: List[Dict[str, Any]], fatigue: Dict[str, Any], host: str) -> float:
    if not host:
        return 0.3
    fail = int(fatigue.get(host, 0) or 0)
    rep = next((r for r in reps if str(r.get("host")) == host), None)
    tier = str(rep.get("tier", "")) if rep else ""
    base = 0.15 if tier == "TRUSTED" else 0.35 if tier == "PROBATION" else 0.45 if tier == "PAUSED" else 0.3
    return clamp(base + 0.15 * min(fail, 4))


def _simulate_one(action: Dict[str, Any], history, reps, fatigue, sensitive_types) -> Dict[str, Any]:
    stage = str(action.get("missionStage") or "")
    host = str(action.get("sourceTarget") or action.get("source") or "")
    ctype = str(action.get("contentType") or "")
    base_score = float(action.get("finalScore", 0.5))
    safe = bool(action.get("safe", True))

    success = _stage_success(history, stage)
    failure_prob = clamp(1.0 - success)
    source_risk = _source_risk(reps, fatigue, host)
    publish_risk = clamp(
        (0.5 if ctype in sensitive_types else 0.2)
        + (0.3 if stage == "PUBLIC_PUBLISH" and ctype in sensitive_types else 0.0)
    )
    safety_risk = clamp((0.0 if safe else 0.7) + (0.2 if ctype in sensitive_types else 0.0))
    repair_cost = clamp(0.3 + 0.5 * failure_prob + 0.2 * source_risk)
    time_cost = clamp(0.2 + 0.4 * source_risk + (0.2 if stage in ("SOURCE_FETCH", "SOURCE_READ") else 0.0))
    moves_mission = stage not in ("REPORTING", "MAINTENANCE", "SECURITY_DEFENSE") and success >= 0.4
    expected_value = clamp(
        base_score * success - 0.4 * publish_risk - 0.5 * safety_risk - 0.2 * repair_cost
    )
    return {
        "action": action.get("actionType") or stage,
        "mission_stage": stage,
        "expected_value": round(expected_value, 3),
        "failure_probability": round(failure_prob, 3),
        "publish_risk": round(publish_risk, 3),
        "safety_risk": round(safety_risk, 3),
        "source_risk": round(source_risk, 3),
        "repair_cost": round(repair_cost, 3),
        "time_cost": round(time_cost, 3),
        "likely_next_stage": _NEXT_STAGE.get(stage),
        "likely_blocker": (
            "source unreachable / low authority"
            if source_risk > 0.5
            else "cross-source verification" if publish_risk > 0.5 else None
        ),
        "moves_mission_forward": moves_mission,
    }


def _ctx(payload: Dict[str, Any]):
    history = [h for h in (opt(payload, "stage_outcomes", []) or []) if isinstance(h, dict)]
    reps = [r for r in (opt(payload, "source_reputation", []) or []) if isinstance(r, dict)]
    fatigue = opt(payload, "source_fatigue", {}) or {}
    sensitive = set(opt(payload, "sensitive_content_types", ["APPARITION", "CHURCH_DOCUMENT", "SACRAMENT", "PRAYER"]))
    return history, reps, fatigue, sensitive


def simulate_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Simulate a single candidate action's likely outcome."""
    action = require(payload, "action")
    sim = _simulate_one(action, *_ctx(payload))
    return envelope(
        result={"simulation": sim},
        confidence=0.75,
        reasoning=f"Simulated {sim['action']}: EV {sim['expected_value']}, fail prob {sim['failure_probability']}.",
        evidence=[f"EV={sim['expected_value']}", f"publish_risk={sim['publish_risk']}", f"safety_risk={sim['safety_risk']}"],
        risk_level=risk_from_score(max(sim["publish_risk"], sim["safety_risk"], sim["source_risk"])),
        recommended_next_action="compare-counterfactuals" if sim["moves_mission_forward"] else "reconsider-action",
    )


def predict_action_outcome(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Predict success/failure + the most likely resulting stage."""
    action = require(payload, "action")
    sim = _simulate_one(action, *_ctx(payload))
    predicted = "success" if sim["failure_probability"] < 0.5 else "failure"
    return envelope(
        result={
            "predicted_outcome": predicted,
            "success_probability": round(1 - sim["failure_probability"], 3),
            "likely_next_stage": sim["likely_next_stage"],
            "likely_blocker": sim["likely_blocker"],
        },
        confidence=clamp(0.6 + abs(0.5 - sim["failure_probability"])),
        reasoning=f"Predicted {predicted} (p={round(1 - sim['failure_probability'], 3)}).",
        evidence=[f"next={sim['likely_next_stage']}", f"blocker={sim['likely_blocker']}"],
        risk_level=risk_from_score(sim["failure_probability"]),
        recommended_next_action="proceed" if predicted == "success" else "mitigate-first",
    )


def estimate_failure_modes(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Enumerate the likely ways an action fails, ranked by probability."""
    action = require(payload, "action")
    history, reps, fatigue, sensitive = _ctx(payload)
    sim = _simulate_one(action, history, reps, fatigue, sensitive)
    modes = []
    if sim["source_risk"] > 0.4:
        modes.append({"mode": "source_unreachable_or_low_authority", "probability": sim["source_risk"]})
    if sim["publish_risk"] > 0.4:
        modes.append({"mode": "blocked_by_cross_source_verification", "probability": sim["publish_risk"]})
    if sim["safety_risk"] > 0.4:
        modes.append({"mode": "safety_or_communion_gate_block", "probability": sim["safety_risk"]})
    if sim["failure_probability"] > 0.4:
        modes.append({"mode": "stage_historically_fails", "probability": sim["failure_probability"]})
    modes.sort(key=lambda m: m["probability"], reverse=True)
    return envelope(
        result={"failure_modes": modes, "mode_count": len(modes)},
        confidence=0.72,
        reasoning=f"{len(modes)} likely failure mode(s) for {sim['action']}.",
        evidence=[f"{m['mode']} ({m['probability']})" for m in modes[:4]] or ["no dominant failure mode"],
        risk_level=risk_from_score(modes[0]["probability"]) if modes else RISK_LOW,
        recommended_next_action="mitigate-top-failure-mode" if modes else "low-failure-risk",
    )


def estimate_repair_cost(payload: Dict[str, Any]) -> Dict[str, Any]:
    action = require(payload, "action")
    sim = _simulate_one(action, *_ctx(payload))
    return envelope(
        result={"repair_cost": sim["repair_cost"], "time_cost": sim["time_cost"]},
        confidence=0.7,
        reasoning=f"Estimated repair cost {sim['repair_cost']}, time cost {sim['time_cost']}.",
        evidence=[f"repair={sim['repair_cost']}", f"time={sim['time_cost']}"],
        risk_level=risk_from_score(sim["repair_cost"]),
        recommended_next_action="weigh-against-expected-value",
    )


def estimate_publish_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    action = require(payload, "action")
    sim = _simulate_one(action, *_ctx(payload))
    return envelope(
        result={"publish_risk": sim["publish_risk"], "safety_risk": sim["safety_risk"]},
        confidence=0.75,
        reasoning=f"Publish risk {sim['publish_risk']}, safety risk {sim['safety_risk']}.",
        evidence=[f"publish={sim['publish_risk']}", f"safety={sim['safety_risk']}"],
        risk_level=risk_from_score(max(sim["publish_risk"], sim["safety_risk"])),
        recommended_next_action="route-review" if max(sim["publish_risk"], sim["safety_risk"]) > 0.5 else "publish-path-ok",
        safe_to_auto_execute=max(sim["publish_risk"], sim["safety_risk"]) <= 0.35,
    )


def compare_counterfactual_actions(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Simulate every candidate and explain why the best beats the rest."""
    actions = [a for a in (require(payload, "actions") or []) if isinstance(a, dict)]
    ctx = _ctx(payload)
    sims = [_simulate_one(a, *ctx) for a in actions]
    ranked = sorted(sims, key=lambda s: s["expected_value"], reverse=True)
    best = ranked[0] if ranked else None
    explanation = []
    if best:
        for other in ranked[1:4]:
            explanation.append(
                f"'{best['action']}' (EV {best['expected_value']}) beats '{other['action']}' "
                f"(EV {other['expected_value']}): lower risk / higher expected value."
            )
    return envelope(
        result={"ranked": ranked, "best": best, "explanation": explanation},
        confidence=0.78 if sims else 0.3,
        reasoning=(f"Best action: {best['action']} (EV {best['expected_value']})." if best else "No actions to compare."),
        evidence=explanation or [s["action"] for s in ranked[:3]],
        risk_level=risk_from_score(best["safety_risk"]) if best else RISK_LOW,
        recommended_next_action="select-best-action" if best else "no-candidates",
    )
