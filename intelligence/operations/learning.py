"""
Learning from outcomes (true machine-learning behaviour, not just logging).

Converts a single outcome — a successful/failed/rejected job, an admin
correction, a source failure, a duplicate detection — into a structured
learning signal: a lesson, concrete score adjustments TypeScript can apply
to its memory/source-reputation tables, and a memory key/value to persist.

Admin feedback (approve/reject/edit/unpublish/repair) flows through the same
op, so an admin's action becomes a training signal that changes future
behaviour.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import clamp, stable_hash

# outcome.type -> (signal in 0..1, default direction for the subject's score)
_OUTCOME_SIGNAL: Dict[str, float] = {
    "success": 0.9,
    "published": 0.9,
    "approved": 0.95,
    "good_output": 0.85,
    "neutral": 0.5,
    "duplicate_detected": 0.4,
    "failure": 0.15,
    "rejected": 0.1,
    "admin_correction": 0.1,
    "edited": 0.3,
    "unpublished": 0.15,
    "source_failure": 0.1,
    "bad_output": 0.1,
    "missed_opportunity": 0.35,
}

_POSITIVE = {"success", "published", "approved", "good_output"}
_NEGATIVE = {
    "failure",
    "rejected",
    "admin_correction",
    "unpublished",
    "source_failure",
    "bad_output",
}


def learn_from_outcome(payload: Dict[str, Any]) -> Dict[str, Any]:
    outcome = require(payload, "outcome")
    otype = str(outcome.get("type") or "neutral").lower()
    content_type = outcome.get("contentType")
    source_host = outcome.get("sourceHost")
    detail = str(outcome.get("detail") or "")

    signal = _OUTCOME_SIGNAL.get(otype, 0.5)
    positive = otype in _POSITIVE
    negative = otype in _NEGATIVE

    adjustments: List[Dict[str, Any]] = []
    if source_host:
        adjustments.append(
            {
                "target": "source_reputation",
                "key": str(source_host),
                "direction": "increase" if positive else ("decrease" if negative else "hold"),
                "magnitude": round(abs(signal - 0.5) * 2, 3),
            }
        )
    if content_type:
        adjustments.append(
            {
                "target": "content_priority",
                "key": str(content_type),
                # Failures/rejections RAISE attention (more work needed); successes lower urgency.
                "direction": "increase" if negative else ("decrease" if positive else "hold"),
                "magnitude": round(abs(signal - 0.5) * 2, 3),
            }
        )

    if otype in {"rejected", "admin_correction", "unpublished"}:
        lesson = (
            f"An admin {otype.replace('_', ' ')} content"
            + (f" of type {content_type}" if content_type else "")
            + ". Treat this pattern as low-confidence and require stronger verification next time."
        )
    elif otype == "source_failure" and source_host:
        lesson = f"Source {source_host} failed; lower its reputation and prefer alternates."
    elif positive:
        lesson = (
            "Reinforce this approach"
            + (f" for {content_type}" if content_type else "")
            + (f" via source {source_host}" if source_host else "")
            + "."
        )
    else:
        lesson = "Outcome recorded; no strong adjustment warranted."

    key_basis = f"{otype}:{content_type or ''}:{source_host or ''}:{detail[:60]}"
    memory_key = f"learn:{otype}:{stable_hash(key_basis) % 1000000}"

    risk = RISK_MEDIUM if otype in {"admin_correction", "rejected"} else (RISK_LOW if negative else RISK_NONE)
    return envelope(
        result={
            "lesson": lesson,
            "adjustments": adjustments,
            "memory_key": memory_key,
            "memory_value": {"type": otype, "contentType": content_type, "sourceHost": source_host},
            "signal": round(signal, 3),
            "outcome_class": "positive" if positive else ("negative" if negative else "neutral"),
        },
        confidence=clamp(0.6 + abs(signal - 0.5)),
        reasoning=f"Converted '{otype}' outcome into {len(adjustments)} adjustment(s): {lesson}",
        evidence=[f"{a['target']}:{a['key']} {a['direction']} {a['magnitude']}" for a in adjustments]
        or ["no targeted adjustment"],
        risk_level=risk,
        recommended_next_action="apply-learning-adjustments",
        safe_to_auto_execute=positive,  # reinforcing good outcomes is safe; negatives → review
    )
