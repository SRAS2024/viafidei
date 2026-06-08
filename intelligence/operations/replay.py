"""
Replayability & resilience reasoning (spec item: "replayability and resilience").

Postgres durably stores every brain call (``AdminWorkerBrainCall``) and decision
(``AdminWorkerDecision``) — the event-sourced record. These deterministic ops let
the brain reason over that record: replay a stored decision and check it still
holds, compare two decisions, explain why a decision changed, detect decision
drift/looping, recommend per-host / per-stage / per-content-type circuit breaks,
and verify the integrity of stored brain output (corruption / replay checks).

Pure, deterministic, stdlib. Every op returns the standard strict envelope.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import (
    RISK_HIGH,
    RISK_LOW,
    RISK_MEDIUM,
    RISK_NONE,
    envelope,
    opt,
    require,
)
from ..core import clamp

_ENVELOPE_KEYS = {
    "ok",
    "result",
    "confidence",
    "reasoning",
    "evidence",
    "sources_used",
    "risk_level",
    "recommended_next_action",
    "safe_to_auto_execute",
    "error",
}


def _num(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def replay_decision(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Re-evaluate a stored decision against its recorded candidates.

    Deterministically re-selects the best safe candidate (highest finalScore)
    and reports whether it matches the action originally chosen — proving the
    decision is reproducible, or surfacing that inputs/logic have drifted.
    """
    candidates = [c for c in (opt(payload, "candidates", []) or []) if isinstance(c, dict)]
    chosen_stage = str(opt(payload, "chosen_stage", opt(payload, "chosenStage", "")))
    safe = [c for c in candidates if c.get("safe", True)]
    pool = safe or candidates
    best = max(pool, key=lambda c: _num(c.get("finalScore")), default=None)
    replayed_stage = str(best.get("missionStage", "")) if best else ""
    reproduced = bool(replayed_stage) and replayed_stage == chosen_stage
    return envelope(
        result={
            "reproduced": reproduced,
            "original_stage": chosen_stage,
            "replayed_stage": replayed_stage,
            "candidate_count": len(candidates),
        },
        confidence=0.85 if candidates else 0.3,
        reasoning=(
            f"Replay {'reproduced' if reproduced else 'diverged from'} the original decision "
            f"({chosen_stage or 'n/a'} vs replay {replayed_stage or 'n/a'})."
        ),
        evidence=[f"{len(candidates)} candidate(s)", f"chosen={chosen_stage}", f"replay={replayed_stage}"],
        risk_level=RISK_NONE if reproduced else RISK_MEDIUM,
        recommended_next_action="ok" if reproduced else "explain-decision-change",
    )


def compare_decisions(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Compare two decisions (e.g. this pass vs the previous one)."""
    a = require(payload, "a") if isinstance(opt(payload, "a", None), dict) else opt(payload, "a", {}) or {}
    b = opt(payload, "b", {}) or {}
    a_stage = str(a.get("missionStage", a.get("mission_stage", "")))
    b_stage = str(b.get("missionStage", b.get("mission_stage", "")))
    a_action = str(a.get("chosenAction", a.get("chosen_action", "")))
    b_action = str(b.get("chosenAction", b.get("chosen_action", "")))
    a_score = _num(a.get("finalScore", a.get("confidence")))
    b_score = _num(b.get("finalScore", b.get("confidence")))
    same_stage = a_stage == b_stage
    same_action = a_action == b_action
    changed = not (same_stage and same_action)
    return envelope(
        result={
            "changed": changed,
            "same_stage": same_stage,
            "same_action": same_action,
            "score_delta": round(b_score - a_score, 4),
            "from": {"stage": a_stage, "action": a_action},
            "to": {"stage": b_stage, "action": b_action},
        },
        confidence=0.9,
        reasoning=(
            "Decision unchanged."
            if not changed
            else f"Decision changed: {a_stage or '?'}/{a_action or '?'} → {b_stage or '?'}/{b_action or '?'}."
        ),
        evidence=[f"score Δ {round(b_score - a_score, 3)}"],
        risk_level=RISK_NONE if not changed else RISK_LOW,
        recommended_next_action="explain-decision-change" if changed else "ok",
    )


def explain_decision_change(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain why a decision changed between two passes."""
    prev = opt(payload, "previous", {}) or {}
    curr = opt(payload, "current", {}) or {}
    changes = [str(c) for c in (opt(payload, "world_changes", []) or [])]
    p_stage = str(prev.get("missionStage", prev.get("mission_stage", "")))
    c_stage = str(curr.get("missionStage", curr.get("mission_stage", "")))
    lines: List[str] = []
    if p_stage and c_stage and p_stage != c_stage:
        lines.append(f"Chosen stage moved from {p_stage} to {c_stage}.")
    p_score = _num(prev.get("finalScore", prev.get("confidence")))
    c_score = _num(curr.get("finalScore", curr.get("confidence")))
    if abs(c_score - p_score) >= 0.05:
        direction = "rose" if c_score > p_score else "fell"
        lines.append(f"Chosen action score {direction} {round(abs(c_score - p_score), 2)}.")
    for ch in changes[:6]:
        lines.append(f"World change: {ch}.")
    if not lines:
        lines.append("No material change between the two decisions.")
    return envelope(
        result={"explanation": lines, "from_stage": p_stage, "to_stage": c_stage},
        confidence=0.8,
        reasoning=lines[0],
        evidence=lines[:6],
        risk_level=RISK_NONE,
        recommended_next_action="record-decision-change",
    )


def detect_decision_drift(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Detect oscillation / drift across a sequence of recent decisions."""
    decisions = [d for d in (require(payload, "decisions") or []) if isinstance(d, dict)]
    stages = [str(d.get("missionStage", d.get("mission_stage", ""))) for d in decisions]
    unique = len(set(s for s in stages if s))
    # Oscillation: A,B,A,B alternation between exactly two stages.
    oscillating = (
        len(stages) >= 4
        and unique == 2
        and all(stages[i] != stages[i + 1] for i in range(len(stages) - 1))
    )
    dominant = ""
    if stages:
        dominant = max(set(stages), key=stages.count)
    dom_share = (stages.count(dominant) / len(stages)) if stages else 0.0
    drift = oscillating or dom_share >= 0.8
    return envelope(
        result={
            "drift": drift,
            "oscillating": oscillating,
            "unique_stages": unique,
            "dominant_stage": dominant,
            "dominant_share": round(dom_share, 3),
            "window": len(stages),
        },
        confidence=0.8 if decisions else 0.3,
        reasoning=(
            f"Decision drift detected ({'oscillating' if oscillating else 'single-stage fixation'})."
            if drift
            else f"No drift: {unique} distinct stage(s) over {len(stages)} decision(s)."
        ),
        evidence=stages[-8:] or ["no decisions"],
        risk_level=RISK_MEDIUM if drift else RISK_NONE,
        recommended_next_action="recommend-unblock-strategy" if drift else "ok",
    )


def recommend_circuit_break(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Recommend a circuit-breaker state per host / stage / content-type.

    Opens the breaker when the recent failure rate is high enough over enough
    attempts; half-open after a single recent success; closed when healthy.
    """
    scope = str(opt(payload, "scope", "host"))
    key = str(opt(payload, "key", ""))
    attempts = int(_num(opt(payload, "attempts", 0)))
    failures = int(_num(opt(payload, "failures", 0)))
    consecutive = int(_num(opt(payload, "consecutive_failures", failures)))
    fail_rate = (failures / attempts) if attempts > 0 else 0.0
    state = "closed"
    cooldown = 0
    if attempts >= 3 and (fail_rate >= 0.6 or consecutive >= 3):
        state = "open"
        cooldown = min(8, 2 + consecutive)
    elif fail_rate >= 0.4 and attempts >= 3:
        state = "half-open"
        cooldown = 1
    return envelope(
        result={
            "scope": scope,
            "key": key,
            "state": state,
            "fail_rate": round(fail_rate, 3),
            "attempts": attempts,
            "cooldown_passes": cooldown,
        },
        confidence=0.85 if attempts else 0.3,
        reasoning=(
            f"Circuit for {scope} '{key}' → {state} (fail rate {int(fail_rate * 100)}% over {attempts})."
        ),
        evidence=[f"{failures}/{attempts} failures", f"consecutive={consecutive}"],
        risk_level=RISK_HIGH if state == "open" else RISK_LOW if state == "half-open" else RISK_NONE,
        recommended_next_action="pause-and-cooldown" if state == "open" else "proceed-with-caution"
        if state == "half-open"
        else "proceed",
        safe_to_auto_execute=state != "open",
    )


def check_replay_integrity(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Integrity / corruption check over stored brain output records.

    Verifies each record carries the strict envelope shape with an in-range
    confidence — the brain-memory corruption / fuzz check that proves stored
    output is replayable and not silently malformed.
    """
    records = [r for r in (require(payload, "records") or []) if isinstance(r, dict)]
    corrupt: List[Dict[str, Any]] = []
    for i, r in enumerate(records):
        missing = sorted(_ENVELOPE_KEYS - set(r))
        conf = r.get("confidence")
        bad_conf = not isinstance(conf, (int, float)) or not (0.0 <= float(conf) <= 1.0)
        if missing or bad_conf:
            corrupt.append(
                {"index": i, "missing_keys": missing, "bad_confidence": bad_conf}
            )
    healthy = len(records) - len(corrupt)
    integrity = clamp(healthy / max(len(records), 1))
    return envelope(
        result={
            "record_count": len(records),
            "healthy": healthy,
            "corrupt_count": len(corrupt),
            "corrupt": corrupt[:25],
            "integrity_ratio": round(integrity, 3),
        },
        confidence=0.9 if records else 0.3,
        reasoning=(
            f"Replay integrity: {healthy}/{len(records)} record(s) valid "
            f"({int(integrity * 100)}%)."
        ),
        evidence=[f"{len(corrupt)} corrupt record(s)"] if corrupt else ["all records valid"],
        risk_level=RISK_HIGH if corrupt else RISK_NONE,
        recommended_next_action="quarantine-corrupt-records" if corrupt else "ok",
        safe_to_auto_execute=not corrupt,
    )
