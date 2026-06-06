"""
Security analysis of (already-sanitised) external content.

The worker NEVER follows instructions found inside scraped source text.
TypeScript controls the sandbox and sanitises first; this operation then
flags prompt-injection / manipulation patterns so the worker can
quarantine or escalate suspicious material. It only analyses and flags —
it never acts on the content's instructions.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from ..contracts import (
    RISK_HIGH,
    RISK_LOW,
    RISK_MEDIUM,
    RISK_NONE,
    envelope,
    max_risk,
    require,
    risk_from_score,
)
from ..core import clamp, normalize_text

_INJECTION_PATTERNS: List[Tuple[str, float, str]] = [
    (r"ignore (all )?(the )?previous (instructions|prompts?)", 0.9, "instruction-override"),
    (r"disregard (the )?(above|prior|previous|earlier)", 0.85, "instruction-override"),
    (r"you are now|act as|pretend to be|new instructions", 0.6, "role-hijack"),
    (r"system prompt|developer message|assistant prompt", 0.6, "prompt-leak"),
    (r"publish this( immediately)?|approve this|mark as (verified|published)", 0.7, "action-injection"),
    (r"grant (admin|access)|elevate|sudo|give me (admin|access)", 0.8, "privilege-escalation"),
    (r"delete (all|the database)|drop table|truncate", 0.85, "destructive-command"),
    (r"send (an? )?(email|request) to|exfiltrate|post to https?://", 0.6, "exfiltration"),
    (r"do not (tell|inform|log)|keep this secret|without (logging|telling)", 0.7, "stealth"),
    (r"base64|eval\(|<script|javascript:|onerror=", 0.6, "code-injection"),
]


def scan_content(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    blob = normalize_text(text)
    hits = []
    for pattern, weight, category in _INJECTION_PATTERNS:
        m = re.search(pattern, blob)
        if m:
            hits.append({"phrase": m.group(0)[:80], "weight": weight, "category": category})

    # Diminishing-returns aggregation so a single strong hit already trips.
    suspicion = 0.0
    for h in sorted(hits, key=lambda x: x["weight"], reverse=True):
        suspicion = suspicion + (1.0 - suspicion) * h["weight"]
    suspicion = clamp(suspicion)

    if suspicion >= 0.6:
        verdict, action, risk = "malicious", "quarantine-and-escalate", RISK_HIGH
    elif suspicion >= 0.3:
        verdict, action, risk = "suspicious", "strip-and-re-review", RISK_MEDIUM
    elif hits:
        verdict, action, risk = "low-risk", "proceed-with-caution", RISK_LOW
    else:
        verdict, action, risk = "clean", "proceed", RISK_NONE

    return envelope(
        result={
            "verdict": verdict,
            "suspicion": round(suspicion, 4),
            "matches": [f"{h['category']}: “{h['phrase']}”" for h in hits],
            "categories": sorted({h["category"] for h in hits}),
        },
        confidence=clamp(0.6 + 0.4 * suspicion) if hits else 0.8,
        reasoning=(
            f"Scanned sanitised content for manipulation patterns: {len(hits)} hit(s), "
            f"suspicion={suspicion:.2f}. The worker will not follow any instructions in this text."
        ),
        evidence=[f"{h['category']}: “{h['phrase']}”" for h in hits] or ["no manipulation patterns matched"],
        risk_level=max_risk(risk, risk_from_score(suspicion)),
        recommended_next_action=action,
        safe_to_auto_execute=False,
    )
