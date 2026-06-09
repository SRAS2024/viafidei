"""
Counterfactual reasoning — "what would have happened if I'd chosen differently?"

Given what actually happened on a decision, the brain estimates the likely
outcome of the realistic alternatives (different source, different content type,
repair first, human review, pause + switch mission), compares them, and ranks
the paths. Deterministic heuristics over the decision context TypeScript
supplies; complements ``simulation.compare_counterfactual_actions`` (it does not
replace it — one unified path). Used to improve future action choice.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# Prior effect of each alternative on the expected value of a stuck/failed
# decision, as (delta_value, delta_risk, rationale). Tuned conservatively.
_ALTERNATIVES: Dict[str, Dict[str, Any]] = {
    "different_source": {"dv": 0.25, "dr": 0.0,
                         "why": "a higher-authority source often supplies the missing fields"},
    "different_content_type": {"dv": 0.15, "dr": -0.05,
                               "why": "switching to a less-blocked type keeps the mission growing"},
    "repair_first": {"dv": 0.2, "dr": 0.05,
                     "why": "an in-pass repair can recover the artifact without a new fetch"},
    "human_review": {"dv": 0.1, "dr": -0.2,
                     "why": "review trades throughput for safety on uncertain content"},
    "pause_switch_mission": {"dv": 0.18, "dr": -0.05,
                             "why": "leaving a stuck mission avoids wasted passes"},
    "keep_going": {"dv": -0.1, "dr": 0.1,
                   "why": "repeating the failing action tends to stay stuck"},
}


def _baseline(payload: Dict[str, Any]) -> float:
    """Observed value of what actually happened (0..1)."""
    actual = opt(payload, "actual", {}) or {}
    if "value" in actual:
        try:
            return max(0.0, min(1.0, float(actual["value"])))
        except (TypeError, ValueError):
            pass
    # Derive from outcome: success high, failure/idle low.
    outcome = str(actual.get("outcome") or opt(payload, "outcome", "")).lower()
    return {"advanced": 0.75, "published": 0.9, "repair-planned": 0.5,
            "rejected": 0.2, "idle": 0.25, "failed": 0.15}.get(outcome, 0.4)


def _estimate(alt: str, baseline: float) -> Dict[str, Any]:
    spec = _ALTERNATIVES.get(alt, {"dv": 0.0, "dr": 0.0, "why": "unknown alternative"})
    value = max(0.0, min(1.0, baseline + spec["dv"]))
    return {
        "alternative": alt,
        "estimated_value": round(value, 3),
        "delta_vs_actual": round(value - baseline, 3),
        "risk_change": spec["dr"],
        "rationale": spec["why"],
    }


def run_counterfactual_analysis(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Estimate the outcome of every realistic alternative to what happened."""
    baseline = _baseline(payload)
    alts = opt(payload, "alternatives", list(_ALTERNATIVES.keys())) or list(_ALTERNATIVES)
    results = sorted((_estimate(a, baseline) for a in alts),
                     key=lambda d: d["estimated_value"], reverse=True)
    best = results[0]
    regret = round(max(0.0, best["estimated_value"] - baseline), 3)
    return envelope(
        result={"actual_value": round(baseline, 3), "alternatives": results,
                "best_alternative": best["alternative"], "regret": regret},
        confidence=0.72,
        reasoning=f"Best alternative '{best['alternative']}' (+{best['delta_vs_actual']}); regret {regret}.",
        evidence=[f"{r['alternative']}={r['estimated_value']}" for r in results[:4]],
        risk_level=RISK_LOW if regret < 0.2 else RISK_MEDIUM,
        recommended_next_action="prefer-best-alternative" if regret >= 0.2 else "decision-was-reasonable",
        safe_to_auto_execute=True,
    )


def estimate_alternative_outcome(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Estimate the outcome of one specific alternative."""
    alt = str(require(payload, "alternative"))
    baseline = _baseline(payload)
    est = _estimate(alt, baseline)
    return envelope(
        result=est,
        confidence=0.7,
        reasoning=f"'{alt}' → est. value {est['estimated_value']} ({est['delta_vs_actual']:+}).",
        evidence=[est["rationale"]],
        risk_level=RISK_LOW,
        recommended_next_action="compare-counterfactuals",
        safe_to_auto_execute=True,
    )


def explain_counterfactual_difference(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain why an alternative would have differed from what happened."""
    alt = str(require(payload, "alternative"))
    baseline = _baseline(payload)
    est = _estimate(alt, baseline)
    direction = "better" if est["delta_vs_actual"] > 0 else "worse" if est["delta_vs_actual"] < 0 else "similar"
    return envelope(
        result={"alternative": alt, "direction": direction, **est,
                "explanation": f"Choosing '{alt}' would likely have been {direction}: {est['rationale']}."},
        confidence=0.72,
        reasoning=est["rationale"],
        evidence=[f"delta={est['delta_vs_actual']}", f"risk_change={est['risk_change']}"],
        risk_level=RISK_NONE,
        recommended_next_action="store-counterfactual-lesson",
        safe_to_auto_execute=True,
    )


def rank_counterfactual_paths(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank alternative paths by value net of added risk."""
    baseline = _baseline(payload)
    alts = opt(payload, "alternatives", list(_ALTERNATIVES.keys())) or list(_ALTERNATIVES)
    scored = []
    for a in alts:
        est = _estimate(a, baseline)
        # Net score rewards value, penalises added risk.
        net = est["estimated_value"] - max(0.0, est["risk_change"])
        scored.append({**est, "net_score": round(net, 3)})
    scored.sort(key=lambda d: d["net_score"], reverse=True)
    return envelope(
        result={"ranked": scored, "winner": scored[0]["alternative"]},
        confidence=0.72,
        reasoning=f"Top path: {scored[0]['alternative']} (net {scored[0]['net_score']}).",
        evidence=[f"{d['alternative']}={d['net_score']}" for d in scored[:4]],
        risk_level=RISK_LOW,
        recommended_next_action="apply-best-path",
        safe_to_auto_execute=True,
    )
