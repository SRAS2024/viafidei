"""
Mission control — the layer above single-action selection.

The worker reasons about long-term missions (e.g. "build complete prayers
section"): subgoals, existing vs missing content, coverage, blockers, completion
percentage, and the next best action. Deterministic + stdlib; reasons over
mission state TypeScript supplies from Postgres (content goals, published
counts, source coverage, route/schema/UI support).
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import clamp


def _completion(existing: int, target: int) -> float:
    return clamp(existing / target) if target > 0 else (1.0 if existing > 0 else 0.0)


def build_mission_tree(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build a mission tree from content goals: goal → subgoals + completion."""
    goals = [g for g in (require(payload, "goals") or []) if isinstance(g, dict)]
    missions: List[Dict[str, Any]] = []
    for g in goals:
        ctype = str(g.get("contentType") or g.get("content_type") or "")
        existing = int(g.get("currentValidCount", g.get("existing", 0)) or 0)
        target = int(g.get("desiredTarget", g.get("target", 0)) or 0)
        hard_max = g.get("canonicalMax", g.get("hardMax"))
        pct = _completion(existing, hard_max if hard_max else target)
        missions.append(
            {
                "goal": f"Build complete {ctype.lower()} section",
                "content_type": ctype,
                "existing_content": existing,
                "target": target,
                "hard_max": hard_max,
                "completion_pct": round(pct, 3),
                "status": "complete" if pct >= 1.0 else "in_progress" if existing > 0 else "not_started",
            }
        )
    missions.sort(key=lambda m: m["completion_pct"])
    return envelope(
        result={"missions": missions, "mission_count": len(missions)},
        confidence=0.85 if goals else 0.3,
        reasoning=f"Mission tree: {len(missions)} content missions; "
        f"{sum(1 for m in missions if m['status'] == 'complete')} complete.",
        evidence=[f"{m['content_type']}: {int(m['completion_pct']*100)}%" for m in missions[:6]],
        risk_level=RISK_NONE,
        recommended_next_action="rank-subgoals",
    )


def update_mission_progress(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Update one mission's completion from existing/target counts."""
    ctype = str(opt(payload, "content_type", ""))
    existing = int(opt(payload, "existing", 0))
    target = int(opt(payload, "target", 0))
    pct = _completion(existing, target)
    return envelope(
        result={
            "content_type": ctype,
            "completion_pct": round(pct, 3),
            "remaining": max(0, target - existing),
            "status": "complete" if pct >= 1.0 else "in_progress" if existing > 0 else "not_started",
        },
        confidence=0.85,
        reasoning=f"{ctype}: {int(pct*100)}% ({existing}/{target}).",
        evidence=[f"{existing}/{target}"],
        risk_level=RISK_NONE,
        recommended_next_action="continue-mission",
    )


def detect_mission_blockers(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Identify what's blocking a mission: no source/route/schema/UI support."""
    m = require(payload, "mission")
    blockers: List[str] = []
    if not m.get("source_coverage", True):
        blockers.append("no approved source coverage for this content type")
    if not m.get("public_route", True):
        blockers.append("no public route exposes this content type")
    if not m.get("schema_support", True):
        blockers.append("schema lacks fields this content type needs")
    if not m.get("ui_support", True):
        blockers.append("no UI surface for this content type")
    if int(m.get("verification_failures", 0)) >= 3:
        blockers.append("repeated cross-source verification failures")
    return envelope(
        result={"blockers": blockers, "blocked": bool(blockers), "content_type": m.get("content_type")},
        confidence=0.8,
        reasoning=(f"{len(blockers)} mission blocker(s)." if blockers else "No mission blockers."),
        evidence=blockers or ["mission unblocked"],
        risk_level=RISK_MEDIUM if blockers else RISK_NONE,
        recommended_next_action="file-developer-request" if blockers else "proceed",
        safe_to_auto_execute=not blockers,
    )


def rank_subgoals(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank missions/subgoals by (gap × priority), least-complete first."""
    missions = [m for m in (require(payload, "missions") or []) if isinstance(m, dict)]
    ranked = []
    for m in missions:
        pct = float(m.get("completion_pct", 0.0))
        priority = float(m.get("priority", 0.5))
        gap = 1.0 - pct
        ranked.append({**m, "rank_score": round(gap * (0.5 + priority), 3)})
    ranked.sort(key=lambda x: x["rank_score"], reverse=True)
    return envelope(
        result={"ranked": ranked, "next_subgoal": ranked[0] if ranked else None},
        confidence=0.82 if missions else 0.3,
        reasoning=f"Ranked {len(ranked)} subgoal(s); next = {ranked[0].get('content_type') if ranked else 'n/a'}.",
        evidence=[f"{m.get('content_type')}: {m['rank_score']}" for m in ranked[:6]],
        risk_level=RISK_NONE,
        recommended_next_action="recommend-next-mission-action",
    )


def recommend_next_mission_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Recommend the next concrete action for the least-complete mission."""
    mission = require(payload, "mission")
    blockers = [str(b) for b in (opt(payload, "blockers", []) or [])]
    ctype = str(mission.get("content_type", ""))
    if blockers:
        action = f"Resolve blocker first: {blockers[0]} (file a developer request)."
        nxt = "REPAIR"
    elif int(mission.get("existing_content", 0)) == 0:
        action = f"Seed {ctype} from curated ground-truth, then discover live sources."
        nxt = "DISCOVERY"
    else:
        action = f"Discover + verify additional {ctype} content toward the target."
        nxt = "DISCOVERY"
    return envelope(
        result={"action": action, "next_stage": nxt, "content_type": ctype},
        confidence=0.78,
        reasoning=action,
        evidence=[f"content_type={ctype}", f"blockers={len(blockers)}"],
        risk_level=RISK_LOW if blockers else RISK_NONE,
        recommended_next_action=nxt.lower(),
    )
