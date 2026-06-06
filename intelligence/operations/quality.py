"""
Quality scoring across the spec's dimensions.

Produces a per-record quality profile the worker uses both as a publish
signal and to drive future priorities. TypeScript's publish gate makes
the final call; the brain scores and explains. Hard gates (no source,
no citation, missing required fields, high duplicate/communion risk)
drive ``publish_readiness`` to zero.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import clamp

_AUTHORITY = {
    "OFFICIAL": 1.0,
    "VATICAN": 1.0,
    "DIOCESAN": 0.9,
    "CONFERENCE": 0.88,
    "TRUSTED": 0.8,
    "RELIABLE": 0.65,
    "SECONDARY": 0.5,
    "UNKNOWN": 0.4,
    "UNTRUSTED": 0.2,
}

# Content types that demand stricter doctrinal handling.
_SENSITIVE = {"APPARITION", "SACRAMENT", "CHURCH_DOCUMENT", "DOCTRINE", "SCRIPTURE", "POPE", "DOCTOR"}


def _avg_authority(sources: Any) -> float:
    if not isinstance(sources, list) or not sources:
        return 0.0
    vals = []
    for s in sources:
        if isinstance(s, dict):
            vals.append(_AUTHORITY.get(str(s.get("authorityLevel") or "UNKNOWN").upper(), 0.4))
        else:
            vals.append(0.4)
    return sum(vals) / len(vals)


def score_quality(payload: Dict[str, Any]) -> Dict[str, Any]:
    record = require(payload, "record")
    ctype = str(record.get("contentType") or "DEFAULT").upper()
    sensitive = ctype in _SENSITIVE

    title = str(record.get("title") or "").strip()
    summary = str(record.get("summary") or "").strip()
    body = str(record.get("body") or record.get("text") or "").strip()
    slug = str(record.get("slug") or "").strip()
    sources = record.get("sources") if isinstance(record.get("sources"), list) else []
    citations = record.get("citations") if isinstance(record.get("citations"), list) else []
    relationships = record.get("relationships") if isinstance(record.get("relationships"), list) else []
    translations = record.get("translations") if isinstance(record.get("translations"), list) else []

    # ── Sub-scores (each 0..1) ──
    completeness = clamp(
        (0.35 if title else 0.0)
        + (0.25 if summary else 0.0)
        + (0.4 * clamp(len(body) / 600.0))
    )
    citation_strength = clamp(len(citations) / 3.0)
    source_authority = _avg_authority(sources)
    relationship_richness = clamp(len(relationships) / 4.0)

    communion_risk = clamp(float(opt(record, "communionRisk", 0.0)))
    if sensitive:
        doctrinal_safety = clamp((1.0 - communion_risk) * (1.0 if citations else 0.5))
    else:
        doctrinal_safety = clamp(1.0 - communion_risk)

    freshness_map = {
        "TIMELESS": 1.0,
        "YEARLY": 0.8,
        "SEASONAL": 0.7,
        "DAILY": 0.5,
        "FREQUENTLY_CHANGING": 0.4,
        "LOCATION_SPECIFIC": 0.5,
        "SOURCE_DEPENDENT": 0.6,
    }
    freshness = freshness_map.get(str(opt(record, "freshnessClass", "")).upper(), 0.7)

    translation_readiness = clamp(0.5 + 0.5 * clamp(len(translations) / 2.0))
    duplicate_risk = clamp(float(opt(record, "duplicateScore", 0.0)))
    duplicate_safety = clamp(1.0 - duplicate_risk)
    ui_readiness = clamp(
        (0.4 if slug else 0.0) + (0.3 if summary else 0.0) + (0.3 if body else 0.0)
    )

    # ── Publish gates (hard zeros) ──
    gate_reasons: List[str] = []
    publish_readiness = 1.0
    if not sources:
        publish_readiness = 0.0
        gate_reasons.append("no-source")
    if not citations:
        publish_readiness = 0.0
        gate_reasons.append("no-citation")
    if completeness <= 0.0 or not title:
        publish_readiness = 0.0
        gate_reasons.append("missing-required-fields")
    if duplicate_risk >= 0.85:
        publish_readiness = 0.0
        gate_reasons.append("duplicate-detected")
    if communion_risk >= 0.6:
        publish_readiness = 0.0
        gate_reasons.append("communion-risk")
    if sensitive and source_authority < 0.6:
        publish_readiness = 0.0
        gate_reasons.append("sensitive-type-needs-authoritative-source")

    if publish_readiness > 0:
        # When no hard gate fired, publish readiness is the weakest of the
        # publish-critical dimensions.
        publish_readiness = min(
            completeness, citation_strength, source_authority, doctrinal_safety, duplicate_safety
        )

    overall = clamp(
        0.18 * completeness
        + 0.12 * citation_strength
        + 0.14 * source_authority
        + 0.08 * relationship_richness
        + 0.14 * doctrinal_safety
        + 0.06 * freshness
        + 0.04 * translation_readiness
        + 0.08 * duplicate_safety
        + 0.06 * ui_readiness
        + 0.10 * publish_readiness
    )
    if gate_reasons:
        overall = min(overall, 0.49)  # never "publishable-looking" if a gate fired

    subscores = {
        "completeness": round(completeness, 4),
        "citation_strength": round(citation_strength, 4),
        "source_authority": round(source_authority, 4),
        "relationship_richness": round(relationship_richness, 4),
        "doctrinal_safety": round(doctrinal_safety, 4),
        "freshness": round(freshness, 4),
        "translation_readiness": round(translation_readiness, 4),
        "duplicate_safety": round(duplicate_safety, 4),
        "ui_readiness": round(ui_readiness, 4),
        "publish_readiness": round(publish_readiness, 4),
    }
    weak = sorted([k for k, v in subscores.items() if v < 0.6], key=lambda k: subscores[k])

    if gate_reasons:
        action, risk = "block-and-repair", RISK_HIGH
    elif overall >= 0.85:
        action, risk = "publish", RISK_LOW
    elif overall >= 0.6:
        action, risk = "draft-then-improve", RISK_MEDIUM
    else:
        action, risk = "improve-before-publish", RISK_MEDIUM

    return envelope(
        result={
            "content_type": ctype,
            "overall": round(overall, 4),
            "subscores": subscores,
            "publish_gates_failed": gate_reasons,
            "weak_dimensions": weak,
            "sensitive": sensitive,
        },
        confidence=clamp(overall),
        reasoning=(
            f"{ctype} record scored {overall:.2f}. "
            + (f"Publish gates failed: {', '.join(gate_reasons)}." if gate_reasons else "No publish gate failed.")
        ),
        evidence=[f"{k}={subscores[k]}" for k in weak[:5]] or ["all dimensions >= 0.6"],
        risk_level=risk if not gate_reasons else RISK_HIGH,
        recommended_next_action=action,
        safe_to_auto_execute=(action == "publish"),
    )
