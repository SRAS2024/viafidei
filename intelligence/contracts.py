"""
Structured request/response contracts shared by every brain operation.

Every operation returns an *envelope* with the same shape so the
TypeScript bridge can validate it once (with Zod) and trust it
everywhere. The envelope mirrors the spec's required fields:

    result                  op-specific payload (JSON-serialisable)
    confidence              0..1 — how sure the brain is
    reasoning               short human-readable summary of the "why"
    evidence                concrete signals the conclusion rests on
    sources_used            source identifiers/urls the brain leaned on
    risk_level              none | low | medium | high | critical
    recommended_next_action what TypeScript should consider doing next
    safe_to_auto_execute    may TS act without human review?

``ok`` / ``error`` wrap transport-level success. ``op`` and ``meta`` are
filled in by ``intelligence.main`` so individual operations don't have to.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# ── Risk ladder ──────────────────────────────────────────────────────
RISK_NONE = "none"
RISK_LOW = "low"
RISK_MEDIUM = "medium"
RISK_HIGH = "high"
RISK_CRITICAL = "critical"

RISK_LEVELS = (RISK_NONE, RISK_LOW, RISK_MEDIUM, RISK_HIGH, RISK_CRITICAL)
_RISK_ORDER = {level: i for i, level in enumerate(RISK_LEVELS)}


class BrainError(Exception):
    """Raised for malformed requests or recoverable operation failures.

    ``intelligence.main`` catches this and turns it into an error envelope
    instead of crashing the whole process, so one bad request never takes
    the brain down.
    """


def max_risk(*levels: str) -> str:
    """Return the most severe risk level among the arguments."""
    worst = RISK_NONE
    for level in levels:
        if level in _RISK_ORDER and _RISK_ORDER[level] > _RISK_ORDER[worst]:
            worst = level
    return worst


def risk_at_least(level: str, threshold: str) -> bool:
    """True when ``level`` is as severe as (or worse than) ``threshold``."""
    return _RISK_ORDER.get(level, 0) >= _RISK_ORDER.get(threshold, 0)


def risk_from_score(score: float) -> str:
    """Map a 0..1 risk score onto the risk ladder.

    Used by operations that compute a continuous risk value (communion
    risk, contradiction severity, security suspicion) and need to emit a
    discrete ``risk_level``.
    """
    if score >= 0.85:
        return RISK_CRITICAL
    if score >= 0.6:
        return RISK_HIGH
    if score >= 0.35:
        return RISK_MEDIUM
    if score > 0.1:
        return RISK_LOW
    return RISK_NONE


def default_safety(confidence: float, risk_level: str) -> bool:
    """Conservative default for ``safe_to_auto_execute``.

    The brain only ever *recommends* auto-execution; TypeScript's policy
    engine makes the final call. We default to "safe" only when the brain
    is confident AND the risk is low/none. Anything medium-or-worse, or
    low confidence, defaults to "escalate for review".
    """
    return confidence >= 0.75 and not risk_at_least(risk_level, RISK_MEDIUM)


def envelope(
    *,
    result: Any,
    confidence: float,
    reasoning: str,
    evidence: Optional[List[str]] = None,
    sources_used: Optional[List[str]] = None,
    risk_level: str = RISK_LOW,
    recommended_next_action: str = "",
    safe_to_auto_execute: Optional[bool] = None,
    ok: bool = True,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a contract-compliant response envelope.

    ``confidence`` is clamped to 0..1. ``risk_level`` is validated against
    the ladder. ``safe_to_auto_execute`` defaults conservatively when not
    supplied.
    """
    conf = max(0.0, min(1.0, float(confidence)))
    level = risk_level if risk_level in _RISK_ORDER else RISK_MEDIUM
    if safe_to_auto_execute is None:
        safe_to_auto_execute = default_safety(conf, level)
    return {
        "ok": ok,
        "result": result,
        "confidence": conf,
        "reasoning": reasoning,
        "evidence": list(evidence or []),
        "sources_used": list(sources_used or []),
        "risk_level": level,
        "recommended_next_action": recommended_next_action,
        "safe_to_auto_execute": bool(safe_to_auto_execute) and ok,
        "error": error,
    }


def error_envelope(message: str) -> Dict[str, Any]:
    """An envelope representing a failed operation. Never auto-executable."""
    return envelope(
        result=None,
        confidence=0.0,
        reasoning=f"Operation failed: {message}",
        risk_level=RISK_HIGH,
        recommended_next_action="escalate-for-review",
        safe_to_auto_execute=False,
        ok=False,
        error=message,
    )


# ── Small request-parsing helpers ────────────────────────────────────
def require(payload: Dict[str, Any], key: str) -> Any:
    """Fetch a required key from a request payload or raise BrainError."""
    if not isinstance(payload, dict) or key not in payload:
        raise BrainError(f"missing required field: {key!r}")
    return payload[key]


def opt(payload: Dict[str, Any], key: str, default: Any) -> Any:
    """Fetch an optional key with a default."""
    if not isinstance(payload, dict):
        return default
    value = payload.get(key, default)
    return default if value is None else value
