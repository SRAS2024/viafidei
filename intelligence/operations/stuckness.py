"""
Stuckness detection — granular loop detectors + unblock strategy.

The umbrella ``detect_stuckness`` lives in self_model.py; these are the
fine-grained detectors the worker uses to change strategy instead of repeating a
failing path. Deterministic + stdlib; reasons over recent decisions, repairs,
source fatigue, and published-content growth supplied by TypeScript.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt


def detect_action_loop(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Same mission stage chosen too often across recent passes."""
    decisions = [d for d in (opt(payload, "recent_decisions", []) or []) if isinstance(d, dict)]
    counts: Dict[str, int] = {}
    for d in decisions:
        s = str(d.get("missionStage") or "")
        if s:
            counts[s] = counts.get(s, 0) + 1
    dominant, n = max(counts.items(), key=lambda kv: kv[1], default=("", 0))
    loop = len(decisions) >= 5 and n >= max(5, int(0.7 * len(decisions)))
    return envelope(
        result={"loop": loop, "stage": dominant, "count": n, "window": len(decisions)},
        confidence=0.78 if decisions else 0.3,
        reasoning=(f"Action loop: '{dominant}' {n}/{len(decisions)}." if loop else "No action loop."),
        evidence=[f"{s}:{c}" for s, c in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:4]],
        risk_level=RISK_MEDIUM if loop else RISK_NONE,
        recommended_next_action="diversify-mission-stage" if loop else "continue",
    )


def detect_source_loop(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Same source failing repeatedly → deprioritize it."""
    fatigue = opt(payload, "source_fatigue", {}) or {}
    threshold = int(opt(payload, "threshold", 3))
    bad = sorted(
        [(h, int(n)) for h, n in fatigue.items() if int(n) >= threshold],
        key=lambda kv: kv[1],
        reverse=True,
    )
    return envelope(
        result={"loop": bool(bad), "deprioritize": [h for h, _ in bad]},
        confidence=0.8 if fatigue else 0.3,
        reasoning=(f"Source loop: {len(bad)} host(s) failing ≥{threshold}x." if bad else "No source loop."),
        evidence=[f"{h}:{n}" for h, n in bad[:5]] or ["no failing sources"],
        risk_level=RISK_MEDIUM if bad else RISK_NONE,
        recommended_next_action="deprioritize-sources" if bad else "sources-ok",
    )


def detect_repair_loop(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Same repair plan failing repeatedly."""
    repairs = [r for r in (opt(payload, "recent_repairs", []) or []) if isinstance(r, dict)]
    failed: Dict[str, int] = {}
    for r in repairs:
        if str(r.get("status")) in ("FAILED", "ABANDONED"):
            k = str(r.get("kind") or "")
            failed[k] = failed.get(k, 0) + 1
    loops = sorted([(k, n) for k, n in failed.items() if n >= 3], key=lambda kv: kv[1], reverse=True)
    return envelope(
        result={"loop": bool(loops), "failing_repairs": dict(loops)},
        confidence=0.8 if repairs else 0.3,
        reasoning=(f"Repair loop: {len(loops)} repair kind(s) failing ≥3x." if loops else "No repair loop."),
        evidence=[f"{k}:{n}" for k, n in loops[:4]] or ["no failing repairs"],
        risk_level=RISK_HIGH if loops else RISK_NONE,
        recommended_next_action="escalate-repair-strategy" if loops else "repairs-ok",
    )


def detect_no_growth(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Worker active but no public content growth across passes."""
    passes = int(opt(payload, "pass_count", 0))
    published_delta = int(opt(payload, "published_delta", 0))
    no_growth = passes >= 5 and published_delta == 0
    return envelope(
        result={"no_growth": no_growth, "passes": passes, "published_delta": published_delta},
        confidence=0.8 if passes else 0.3,
        reasoning=(
            f"No growth across {passes} passes." if no_growth else f"Growth: +{published_delta} over {passes} passes."
        ),
        evidence=[f"passes={passes}", f"published_delta={published_delta}"],
        risk_level=RISK_HIGH if no_growth else RISK_NONE,
        recommended_next_action="explain-no-growth" if no_growth else "growing",
    )


def explain_no_growth(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Walk the chain and name the most likely reason growth stalled."""
    blockers = [str(b) for b in (opt(payload, "blockers", []) or [])]
    fatigue = opt(payload, "source_fatigue", {}) or {}
    pending_artifacts = int(opt(payload, "pending_artifacts", 0))
    candidates = int(opt(payload, "candidate_count", 0))
    reasons: List[str] = list(blockers)
    if candidates == 0:
        reasons.append("no fetchable candidates discovered (discovery/source gap)")
    if fatigue and all(int(n) >= 3 for n in fatigue.values()):
        reasons.append("all active sources are failing (source loop)")
    if pending_artifacts > 0:
        reasons.append(f"{pending_artifacts} artifact(s) blocked before publish (verification/QA gate)")
    if not reasons:
        reasons.append("activity is producing artifacts but none reached the publish gate yet")
    return envelope(
        result={"reasons": reasons, "primary": reasons[0]},
        confidence=0.72,
        reasoning=f"Most likely no-growth cause: {reasons[0]}.",
        evidence=reasons[:5],
        risk_level=RISK_MEDIUM,
        recommended_next_action="recommend-unblock-strategy",
    )


def recommend_unblock_strategy(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Given the stuckness signals, recommend a concrete strategy change."""
    signals = [str(s) for s in (opt(payload, "signals", []) or [])]
    strategies: List[str] = []
    joined = " ".join(signals).lower()
    if "source" in joined:
        strategies.append("Deprioritize failing sources; discover alternates from the authority graph.")
    if "stage" in joined or "action loop" in joined:
        strategies.append("Switch mission stage / content type to break the action loop.")
    if "repair" in joined:
        strategies.append("Escalate the failing repair to a developer request with a test plan.")
    if "no growth" in joined or "no content growth" in joined:
        strategies.append("Publish from curated ground-truth knowledge; file a parser/source upgrade request.")
    if not strategies:
        strategies.append("Continue; no decisive stuckness signal.")
    return envelope(
        result={"strategies": strategies, "primary": strategies[0]},
        confidence=0.75 if signals else 0.4,
        reasoning=f"Recommended {len(strategies)} unblock strategy(ies).",
        evidence=strategies[:4],
        risk_level=RISK_LOW,
        recommended_next_action="apply-unblock-strategy",
    )
