"""
Freshness intelligence.

Classifies how time-sensitive a record is so TypeScript can schedule
refresh jobs appropriately: timeless content (saint biographies) rarely
changes; daily content (liturgical readings) must refresh every day.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from ..contracts import RISK_LOW, RISK_NONE, envelope, require
from ..core import normalize_text

# (regex, class, refresh_interval_days)
_RULES: List[Tuple[str, str, int]] = [
    (r"daily reading|today'?s reading|reading of the day|mass reading", "DAILY", 1),
    (r"liturgical calendar|feast of the day|saint of the day|today'?s saint", "DAILY", 1),
    (r"mass time|confession time|adoration schedule|parish hours|office hours", "FREQUENTLY_CHANGING", 7),
    (r"this (year|season)|advent|lent|easter season|ordinary time", "SEASONAL", 30),
    (r"annual|yearly|each year|holy day of obligation", "YEARLY", 180),
    (r"parish|diocese|location|address|directions|near you", "LOCATION_SPECIFIC", 30),
    (r"news|announcement|update|latest", "SOURCE_DEPENDENT", 14),
]

# Content types that are inherently timeless unless the text says otherwise.
_TIMELESS_TYPES = {"PRAYER", "SAINT", "POPE", "DOCTOR", "NOVENA", "LITANY", "CHURCH_DOCUMENT", "DEVOTION"}


def classify_freshness(payload: Dict[str, Any]) -> Dict[str, Any]:
    record = require(payload, "record")
    ctype = str(record.get("contentType") or "").upper()
    blob = normalize_text(" ".join(str(record.get(k) or "") for k in ("title", "summary", "text", "slug")))

    klass, interval = None, None
    for pattern, name, days in _RULES:
        if re.search(pattern, blob):
            klass, interval = name, days
            break

    if klass is None:
        if ctype in _TIMELESS_TYPES:
            klass, interval = "TIMELESS", 365
        else:
            klass, interval = "SOURCE_DEPENDENT", 30

    confidence = 0.85 if (klass != "SOURCE_DEPENDENT") else 0.55
    return envelope(
        result={"freshness_class": klass, "refresh_interval_days": interval},
        confidence=confidence,
        reasoning=f"Classified as {klass} (refresh ~every {interval} day(s)).",
        evidence=[f"content_type={ctype or 'unknown'}"],
        risk_level=RISK_LOW if klass in {"DAILY", "FREQUENTLY_CHANGING"} else RISK_NONE,
        recommended_next_action="schedule-refresh",
        safe_to_auto_execute=True,
    )
