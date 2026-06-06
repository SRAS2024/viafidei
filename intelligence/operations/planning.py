"""
Planning + priority intelligence.

``plan`` reuses the bounded-rationality reasoning principles to produce a
ranked, scored plan and a next-best-action recommendation — TypeScript
stays the conductor and actually executes. ``prioritize`` ranks candidate
work items by mission importance, weakness, user value, source
availability, confidence, risk and dependency order.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Dict, List

from ..brain import decompose_objective
from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require
from ..core import Action, clamp


def plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    objective = str(require(payload, "objective"))
    mem_in = opt(payload, "memories", [])
    mems = [
        SimpleNamespace(text=str(m.get("text") if isinstance(m, dict) else m))
        for m in (mem_in if isinstance(mem_in, list) else [])
    ][:50]
    thoughts = decompose_objective(objective, mems)

    tools = opt(payload, "available_tools", [])
    budget = opt(payload, "budget", {})
    max_steps = int(budget.get("max_steps", 12)) if isinstance(budget, dict) else 12

    actions: List[Action] = []
    for t in tools if isinstance(tools, list) else []:
        if not isinstance(t, dict) or not t.get("name"):
            continue
        actions.append(
            Action(
                name=str(t["name"]),
                args={"objective": objective},
                expected_value=float(t.get("expected_value", 0.7)),
                cost=float(t.get("cost", 0.1)),
                risk=float(t.get("risk", 0.05)),
            )
        )
    internal_value = max((th.value * th.confidence for th in thoughts), default=0.6)
    actions.append(
        Action(
            name="internal_reasoning",
            args={"objective": objective},
            expected_value=internal_value,
            cost=0.02,
            risk=max((th.risk for th in thoughts), default=0.1) * 0.25,
        )
    )

    ranked = sorted(actions, key=lambda a: a.score, reverse=True)
    steps = [
        {
            "step": i + 1,
            "action": a.name,
            "expected_value": round(a.expected_value, 3),
            "cost": round(a.cost, 3),
            "risk": round(a.risk, 3),
            "score": round(a.score, 3),
        }
        for i, a in enumerate(ranked[:max_steps])
    ]
    nba = steps[0] if steps else None
    principles = [
        {"claim": th.claim, "confidence": th.confidence, "value": th.value, "risk": th.risk}
        for th in thoughts
    ]
    return envelope(
        result={"plan": steps, "next_best_action": nba, "principles": principles, "memories_considered": len(mems)},
        confidence=clamp(internal_value),
        reasoning=(
            f"Ranked {len(steps)} action(s) for objective by expected_value - cost - risk; "
            f"next best: {nba['action'] if nba else 'none'}."
        ),
        evidence=[f"{s['action']}: score={s['score']}" for s in steps[:3]],
        risk_level=RISK_LOW,
        recommended_next_action=nba["action"] if nba else "no-action-available",
        safe_to_auto_execute=False,  # the conductor (TS) decides what to run
    )


def prioritize(payload: Dict[str, Any]) -> Dict[str, Any]:
    candidates = require(payload, "candidates")
    if not isinstance(candidates, list):
        candidates = []
    scored: List[Dict[str, Any]] = []
    for c in candidates:
        importance = float(opt(c, "missionImportance", 0.5))
        weakness = float(opt(c, "weakness", 0.5))
        user_value = float(opt(c, "userValue", 0.5))
        source_avail = float(opt(c, "sourceAvailability", 0.5))
        conf = float(opt(c, "confidence", 0.5))
        risk = float(opt(c, "risk", 0.2))
        publish_ready = float(opt(c, "publishReadiness", 0.5))
        dep = float(opt(c, "dependencyDepth", 0.0))
        impact = float(opt(c, "expectedImpact", user_value))
        score = clamp(
            0.22 * importance
            + 0.18 * weakness
            + 0.16 * user_value
            + 0.12 * source_avail
            + 0.10 * conf
            + 0.12 * impact
            + 0.06 * publish_ready
            - 0.15 * risk
            - 0.05 * dep
        )
        scored.append(
            {
                "id": c.get("id"),
                "label": c.get("label") or c.get("title"),
                "score": round(score, 4),
                "drivers": {
                    "importance": importance,
                    "weakness": weakness,
                    "user_value": user_value,
                    "source_availability": source_avail,
                    "expected_impact": impact,
                    "risk": risk,
                },
            }
        )
    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[0] if scored else None
    return envelope(
        result={"ranked": scored, "top": top},
        confidence=top["score"] if top else 0.0,
        reasoning=f"Prioritised {len(scored)} candidate(s); top = {top['label'] if top else 'none'}.",
        evidence=[f"{s['label']}: {s['score']}" for s in scored[:3]] or ["no candidates"],
        risk_level=RISK_LOW if scored else RISK_NONE,
        recommended_next_action="work-top-candidate" if top else "no-work-available",
        safe_to_auto_execute=False,
    )
