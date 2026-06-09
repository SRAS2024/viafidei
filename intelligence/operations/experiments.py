"""
Safe experiment design — bounded, auditable, reversible A/B trials.

Before committing to a larger strategy, the brain designs a limited experiment
(two groups, a small sample, a single metric, a hard cap), evaluates the
result, compares groups, and extracts the lesson. Experiments never bypass the
normal publish gates — they only *measure*; TypeScript runs the plan and
persists ExperimentPlan / ExperimentResult.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

_MAX_SAMPLE = 10  # hard safety cap per group


def design_safe_experiment(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Design a two-group experiment with a bounded sample + a single metric."""
    question = str(require(payload, "question"))
    groups = [str(g) for g in (opt(payload, "groups", []) or [])][:4]
    if len(groups) < 2:
        groups = ["A", "B"]
    metric = str(opt(payload, "metric", "success_rate"))
    sample = max(1, min(_MAX_SAMPLE, int(opt(payload, "sample_per_group", 5))))
    plan = {
        "question": question,
        "groups": groups,
        "metric": metric,
        "sample_per_group": sample,
        "total_budget": sample * len(groups),
        "bounded": True,
        "reversible": True,
        "publishes": False,
        "stop_conditions": ["sample reached", "unsafe content encountered", "metric clearly separated"],
        "safety": "measure-only; all normal publish gates still apply",
    }
    return envelope(
        result=plan,
        confidence=0.85,
        reasoning=f"Experiment: {len(groups)} groups x {sample} = {plan['total_budget']} samples on '{metric}'.",
        evidence=[f"groups={groups}", f"metric={metric}"],
        risk_level=RISK_LOW,
        recommended_next_action="run-experiment-plan",
        safe_to_auto_execute=True,
    )


def run_experiment_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Validate a plan is within safety bounds before TypeScript executes it."""
    plan = require(payload, "plan")
    if not isinstance(plan, dict):
        return envelope(result={"runnable": False}, confidence=0.4,
                        reasoning="plan is not an object.", risk_level=RISK_MEDIUM,
                        recommended_next_action="redesign-experiment", safe_to_auto_execute=False)
    sample = int(plan.get("sample_per_group", 0))
    groups = plan.get("groups", [])
    runnable = (1 <= sample <= _MAX_SAMPLE and isinstance(groups, list) and 2 <= len(groups) <= 4
                and not plan.get("publishes", False))
    return envelope(
        result={"runnable": runnable, "sample_per_group": sample, "group_count": len(groups),
                "within_bounds": runnable},
        confidence=0.85 if runnable else 0.5,
        reasoning="Plan within safety bounds." if runnable else "Plan exceeds safety bounds; redesign.",
        evidence=[f"sample={sample}", f"groups={len(groups)}", f"publishes={plan.get('publishes', False)}"],
        risk_level=RISK_LOW if runnable else RISK_MEDIUM,
        recommended_next_action="execute-bounded" if runnable else "redesign-experiment",
        safe_to_auto_execute=runnable,
    )


def _group_rate(group: Dict[str, Any]) -> float:
    successes = float(group.get("successes", 0))
    n = float(group.get("n", 0)) or 1.0
    return successes / n


def compare_experiment_groups(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Compare group results on the metric; report the leader + the margin."""
    groups = [g for g in (require(payload, "groups")) if isinstance(g, dict)]
    if len(groups) < 2:
        return envelope(result={"conclusive": False}, confidence=0.4,
                        reasoning="need at least two groups.", risk_level=RISK_LOW,
                        recommended_next_action="gather-more-data", safe_to_auto_execute=True)
    rated = sorted(({"group": str(g.get("name", "?")), "rate": round(_group_rate(g), 3),
                     "n": int(g.get("n", 0))} for g in groups),
                   key=lambda d: d["rate"], reverse=True)
    margin = round(rated[0]["rate"] - rated[1]["rate"], 3)
    min_n = min(r["n"] for r in rated)
    conclusive = margin >= 0.2 and min_n >= 3
    return envelope(
        result={"ranked": rated, "leader": rated[0]["group"], "margin": margin,
                "conclusive": conclusive},
        confidence=0.8 if conclusive else 0.55,
        reasoning=(f"'{rated[0]['group']}' leads by {margin}." if conclusive
                   else f"Inconclusive (margin {margin}, min n {min_n})."),
        evidence=[f"{r['group']}={r['rate']}(n={r['n']})" for r in rated],
        risk_level=RISK_NONE,
        recommended_next_action="extract-experiment-lesson" if conclusive else "gather-more-data",
        safe_to_auto_execute=True,
    )


def evaluate_experiment_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Did the experiment answer its question? Return verdict + adopt guidance."""
    cmp = compare_experiment_groups(payload)["result"]
    conclusive = cmp.get("conclusive", False)
    return envelope(
        result={"answered": conclusive, "winner": cmp.get("leader"), "margin": cmp.get("margin"),
                "adopt": conclusive, "needs_more_data": not conclusive},
        confidence=0.8 if conclusive else 0.5,
        reasoning=("Result is conclusive; the winner may be adopted (review-gated for code)."
                   if conclusive else "Result inconclusive; gather more bounded samples."),
        evidence=[f"winner={cmp.get('leader')}", f"margin={cmp.get('margin')}"],
        risk_level=RISK_NONE,
        recommended_next_action="extract-experiment-lesson" if conclusive else "recommend-experiment-followup",
        safe_to_auto_execute=True,
    )


def extract_experiment_lesson(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Turn a conclusive result into a stored, reusable lesson."""
    cmp = compare_experiment_groups(payload)["result"]
    question = str(opt(payload, "question", "experiment"))
    if not cmp.get("conclusive"):
        return envelope(result={"lesson": None}, confidence=0.4,
                        reasoning="No conclusive lesson yet.", risk_level=RISK_LOW,
                        recommended_next_action="gather-more-data", safe_to_auto_execute=True)
    lesson = f"For '{question}', prefer '{cmp['leader']}' (margin {cmp['margin']})."
    return envelope(
        result={"lesson": lesson, "winner": cmp["leader"], "margin": cmp["margin"],
                "scope": str(opt(payload, "scope", "global"))},
        confidence=0.8,
        reasoning=lesson,
        evidence=[f"margin={cmp['margin']}"],
        risk_level=RISK_NONE,
        recommended_next_action="store-lesson",
        safe_to_auto_execute=True,
    )


def recommend_experiment_followup(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Recommend the next experiment when a result is inconclusive."""
    cmp = compare_experiment_groups(payload)["result"] if "groups" in payload else {}
    margin = float(cmp.get("margin", 0.0))
    if margin >= 0.2:
        rec = "result is conclusive; no follow-up needed"
        nxt = "adopt-winner"
    elif margin >= 0.08:
        rec = "increase the sample to confirm the small lead"
        nxt = "rerun-larger-sample"
    else:
        rec = "groups are too close; test a more differentiated pair"
        nxt = "redesign-experiment"
    return envelope(
        result={"recommendation": rec, "margin": round(margin, 3)},
        confidence=0.7,
        reasoning=rec,
        evidence=[f"margin={round(margin,3)}"],
        risk_level=RISK_NONE,
        recommended_next_action=nxt,
        safe_to_auto_execute=True,
    )
