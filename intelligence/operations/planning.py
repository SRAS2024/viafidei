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


def select_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Final action selector — the Python brain's authoritative choice.

    TypeScript samples world state and computes deterministic per-candidate
    sub-scores (truth/safety inputs). This op is the FINAL ranker: it
    re-scores every candidate using learned signals (exact stage outcomes,
    action fatigue, source fatigue, reputation) and selects the action the
    Admin Worker should run next. TypeScript then validates + executes it.

    Required payload: ``candidates`` — a list of action dicts, each with at
    least ``missionStage`` and the TS sub-scores. Optional: ``world``,
    ``stageOutcomes``, ``actionHistory``, ``sourceReputation``,
    ``repairState``, ``memory``.

    Returns the strict decision contract in ``result``.
    """
    candidates = require(payload, "candidates")
    if not isinstance(candidates, list):
        candidates = []
    world = opt(payload, "world", {}) or {}
    stage_outcomes = opt(payload, "stageOutcomes", []) or []
    action_history = opt(payload, "actionHistory", []) or []
    source_rep = opt(payload, "sourceReputation", []) or []
    repair_state = opt(payload, "repairState", {}) or {}
    source_fatigue = opt(payload, "sourceFatigue", {}) or {}
    profiles_in = opt(payload, "contentTypeProfiles", []) or []
    profiles: Dict[str, Dict[str, Any]] = {
        str(p.get("contentType")): p for p in profiles_in if isinstance(p, dict) and p.get("contentType")
    }

    paused = bool(world.get("isPaused"))

    # Recency-weighted selection fatigue (memory decay: recent outcomes
    # matter more). A stage/content-type chosen repeatedly in the last few
    # passes is penalised so the worker does not loop on one action and
    # rotates content types when one stalls.
    recent: Dict[str, float] = {}
    ct_recent: Dict[str, float] = {}
    window = action_history[-12:]
    for i, a in enumerate(window):
        weight = (i + 1) / len(window)  # most-recent entries weigh more
        stage_key = str(a.get("missionStage") if isinstance(a, dict) else a)
        recent[stage_key] = recent.get(stage_key, 0.0) + weight
        ct = a.get("contentType") if isinstance(a, dict) else None
        if ct:
            ct_recent[str(ct)] = ct_recent.get(str(ct), 0.0) + weight

    # Exact stage reliability (replaces approximate failure signals).
    reli: Dict[str, Dict[str, Any]] = {}
    for s in stage_outcomes:
        if isinstance(s, dict) and s.get("stage"):
            reli[str(s["stage"])] = s

    # Source reputation tilt by host.
    rep_by_host: Dict[str, str] = {}
    for r in source_rep:
        if isinstance(r, dict) and r.get("host"):
            rep_by_host[str(r["host"])] = str(r.get("tier", ""))

    def tier_adj(tier: str) -> float:
        return {
            "TRUSTED": 0.08,
            "RELIABLE": 0.04,
            "NEUTRAL": 0.0,
            "WATCH": -0.06,
            "BLOCKED": -0.5,
        }.get(tier, 0.0)

    memories_used: List[str] = []
    reputation_used: List[str] = []
    outcomes_used: List[str] = []

    scored: List[Dict[str, Any]] = []
    for c in candidates:
        if not isinstance(c, dict):
            continue
        stage = str(c.get("missionStage") or c.get("actionType") or "UNKNOWN")
        base = float(c.get("finalScore", 0.0))
        safe = bool(c.get("safe", True))

        # Action fatigue (recency-weighted).
        fatigue = 0.06 * recent.get(stage, 0.0)
        if recent.get(stage, 0.0) >= 1.5:
            memories_used.append(f"action_fatigue:{stage}={round(recent[stage], 2)}")

        # Exact stage reliability (replaces approximate failure signals).
        reli_adj = 0.0
        st = reli.get(stage)
        if st:
            sr = float(st.get("successRate", 0.5))
            reli_adj = (sr - 0.5) * 0.4
            outcomes_used.append(f"{stage}:successRate={round(sr, 2)}")

        # Source reputation tilt + source fatigue.
        src = c.get("sourceTarget")
        src_adj = 0.0
        if isinstance(src, str) and src in rep_by_host:
            src_adj = tier_adj(rep_by_host[src])
            reputation_used.append(f"{src}:{rep_by_host[src]}")
        if isinstance(src, str) and src in source_fatigue:
            src_adj -= 0.05 * float(source_fatigue.get(src, 0) or 0)
            memories_used.append(f"source_fatigue:{src}")

        # Content-type rotation: deprioritise an over-worked content type so
        # one blocked type does not stall the whole site.
        ct = c.get("contentType")
        ct_adj = 0.0
        if isinstance(ct, str) and ct_recent.get(ct, 0.0) >= 2.0:
            ct_adj -= 0.05
            memories_used.append(f"content_type_rotation:{ct}")

        # Content-type intelligence profile: doctrinally-sensitive types are
        # scored conservatively (extra caution before autonomous work).
        profile = profiles.get(str(ct)) if ct else None
        profile_adj = 0.0
        if profile and profile.get("doctrinallySensitive"):
            profile_adj -= 0.03
            memories_used.append(f"profile_caution:{ct}")

        final = clamp(base + reli_adj + src_adj + ct_adj + profile_adj - fatigue)
        scored.append({**c, "_stage": stage, "_safe": safe, "_final": round(final, 4)})

    # Rank: safe first, then final score. Selected = best safe candidate.
    ranked = sorted(scored, key=lambda x: (1 if x["_safe"] else 0, x["_final"]), reverse=True)
    selected = next((s for s in ranked if s["_safe"] and s["_final"] > 0), None)
    if selected is None:
        selected = next((s for s in ranked if s["_safe"]), ranked[0] if ranked else None)

    safety_notes: List[str] = []
    if paused:
        safety_notes.append("worker paused — only security/diagnostics/maintenance are safe")
    if selected is None:
        return envelope(
            result={"selected_action": None, "rejected_alternatives": [], "safety_notes": ["no candidates supplied"]},
            confidence=0.0,
            reasoning="No candidate actions supplied to the final brain.",
            evidence=["candidates=0"],
            risk_level=RISK_NONE,
            recommended_next_action="no-action-available",
            safe_to_auto_execute=False,
        )

    def alt_view(s: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "mission_stage": s["_stage"],
            "action_type": s.get("actionType"),
            "final_score": s["_final"],
            "safe": s["_safe"],
            "rejected_reason": (
                None
                if s is selected
                else (s.get("rejectionReason") or f"lower final score ({s['_final']})")
            ),
        }

    rejected = [alt_view(s) for s in ranked if s is not selected][:8]

    result = {
        "selected_action": selected["_stage"],
        "mission_stage": selected["_stage"],
        "action_type": selected.get("actionType"),
        "target_content_type": selected.get("contentType"),
        "target_source": selected.get("sourceTarget"),
        "target_candidate_url": selected.get("candidateUrl"),
        "target_package_artifact": selected.get("packageArtifactId"),
        "expected_result": selected.get("expectedOutput") or "advance the pipeline",
        "final_score": selected["_final"],
        "confidence_score": float(selected.get("confidenceScore", selected["_final"])),
        "risk_score": float(selected.get("riskScore", 0.1)),
        "urgency_score": float(selected.get("urgencyScore", 0.5)),
        "source_score": float(selected.get("sourceScore", 0.5)),
        "quality_expectation": float(selected.get("qualityExpectation", 0.5)),
        "repair_likelihood": float(selected.get("repairScore", 0.0)),
        "fallback_action": selected.get("fallbackAction"),
        "stop_condition": selected.get("stopCondition"),
        "rejected_alternatives": rejected,
        "reasoning": (
            f"Final brain selected {selected['_stage']} (score {selected['_final']}) "
            f"from {len(ranked)} candidate(s) using exact stage outcomes, action fatigue, "
            f"and source reputation."
        ),
        "evidence_used": [f"{s['_stage']}={s['_final']}" for s in ranked[:4]],
        "memories_used": memories_used[:10],
        "source_reputation_used": reputation_used[:10],
        "stage_outcomes_used": outcomes_used[:10],
        "safety_notes": safety_notes,
    }

    return envelope(
        result=result,
        confidence=clamp(selected["_final"]),
        reasoning=result["reasoning"],
        evidence=result["evidence_used"],
        risk_level=RISK_LOW,
        recommended_next_action=str(selected["_stage"]),
        # Truth + safety gates live in TypeScript; the brain only recommends.
        safe_to_auto_execute=False,
    )
