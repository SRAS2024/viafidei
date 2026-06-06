"""
Missing-information detection.

Analyses a single record (TypeScript supplies the row) and reports which
fields/relationships are missing or weak, with a severity per gap, so
TypeScript can turn the findings into structured worker jobs. Pure,
deterministic; never invents content.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import clamp

# Content types that should always carry citations/sources + dates.
_SENSITIVE = {"APPARITION", "SACRAMENT", "CHURCH_DOCUMENT", "DOCTRINE", "POPE", "DOCTOR", "SAINT"}


def _len(v: Any) -> int:
    return len(v) if isinstance(v, list) else 0


def detect_missing(payload: Dict[str, Any]) -> Dict[str, Any]:
    record = require(payload, "record")
    ctype = str(record.get("contentType") or "DEFAULT").upper()
    sensitive = ctype in _SENSITIVE

    title = str(record.get("title") or "").strip()
    summary = str(record.get("summary") or "").strip()
    body = str(record.get("body") or record.get("text") or "").strip()
    slug = str(record.get("slug") or "").strip()
    sources = _len(record.get("sources"))
    citations = _len(record.get("citations"))
    relationships = _len(record.get("relationships"))
    translations = _len(record.get("translations"))
    dates = _len(record.get("dates"))

    missing: List[Dict[str, str]] = []

    def gap(field: str, severity: str, note: str) -> None:
        missing.append({"field": field, "severity": severity, "note": note})

    if not title:
        gap("title", "critical", "no title")
    if not summary:
        gap("summary", "medium", "no summary")
    if len(body) < 200:
        gap("body", "high" if not body else "medium", "missing or thin body text")
    if not slug:
        gap("slug", "medium", "no slug — cannot route a public page")
    if sources == 0:
        gap("sources", "high", "no source — cannot publish")
    if citations == 0:
        gap("citations", "high", "no citation — cannot publish")
    if relationships == 0:
        gap("relationships", "low", "no relationships — content is isolated")
    if translations == 0:
        gap("translations", "low", "no language variants")
    if sensitive and dates == 0:
        gap("dates", "low", "sensitive type with no dates")
    if sensitive and sources > 0 and citations == 0:
        gap("citations", "high", "sensitive type requires citations")

    # Completeness = fraction of the core fields that are present.
    core_present = sum(
        [bool(title), bool(summary), len(body) >= 200, bool(slug), sources > 0, citations > 0]
    )
    completeness = clamp(core_present / 6.0)

    sev_rank = {"critical": 3, "high": 2, "medium": 1, "low": 0}
    worst = max((sev_rank[m["severity"]] for m in missing), default=-1)
    risk = RISK_MEDIUM if worst >= 2 else (RISK_LOW if worst >= 0 else RISK_NONE)

    return envelope(
        result={
            "content_type": ctype,
            "missing": missing,
            "missing_count": len(missing),
            "overall_completeness": round(completeness, 3),
        },
        confidence=0.8,
        reasoning=(
            f"{ctype}: {len(missing)} gap(s); completeness {completeness:.0%}."
            if missing
            else f"{ctype}: no gaps detected; completeness {completeness:.0%}."
        ),
        evidence=[f"{m['field']} ({m['severity']})" for m in missing[:6]] or ["complete"],
        risk_level=risk,
        recommended_next_action="create-jobs-for-missing" if missing else "no-gaps",
        safe_to_auto_execute=False,
    )
