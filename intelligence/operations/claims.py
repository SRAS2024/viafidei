"""
Claim-level verification.

Upgrades basic number/date contradiction detection into structured claim
extraction + comparison + authority-weighted resolution, used before publishing
factual/sensitive Catholic content. Deterministic + stdlib.

A claim is {subject, predicate, value, source, authority_level, date_extracted,
citation}. Conflicting claims are resolved by the Catholic authority graph
(``authority.py``): the higher-authority value wins; a lower-authority
conflicting claim is blocked pending review.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import normalize_text
from .authority import authority_rank

_YEAR = re.compile(r"\b(1\d{3}|20\d{2})\b")
_MONTH = (
    "january|february|march|april|may|june|july|august|september|october|november|december"
)

# Predicate patterns: (predicate, regex producing the value in group 1).
_PATTERNS: List[tuple] = [
    ("birth_year", re.compile(r"\bborn\b[^.]*?\b(1\d{3}|20\d{2})\b", re.I)),
    ("death_year", re.compile(r"\bdied\b[^.]*?\b(1\d{3}|20\d{2})\b", re.I)),
    ("canonization_year", re.compile(r"\bcanoniz\w*\b[^.]*?\b(1\d{3}|20\d{2})\b", re.I)),
    ("apparition_year", re.compile(r"\bappar\w*\b[^.]*?\b(1\d{3}|20\d{2})\b", re.I)),
    ("papacy_start", re.compile(r"\b(?:elected|pontificate began|reigned from)\b[^.]*?\b(1\d{3}|20\d{2})\b", re.I)),
    ("feast_day", re.compile(rf"\bfeast\b[^.]*?\b((?:{_MONTH})\s+\d{{1,2}})", re.I)),
]


def _extract_from_text(text: str) -> List[Dict[str, str]]:
    claims: List[Dict[str, str]] = []
    for predicate, rx in _PATTERNS:
        m = rx.search(text)
        if m:
            claims.append({"predicate": predicate, "value": m.group(1).strip()})
    return claims


def extract_claims(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Extract structured claims from a source's text."""
    text = str(require(payload, "text"))
    subject = str(opt(payload, "subject", "") or _guess_subject(text))
    source = str(opt(payload, "source", ""))
    authority_level = str(opt(payload, "authority_level", "COMMUNITY")).upper()
    citation = str(opt(payload, "citation", ""))
    raw = _extract_from_text(text)
    claims = [
        {
            "subject": subject,
            "predicate": c["predicate"],
            "value": c["value"],
            "source": source,
            "authority_level": authority_level,
            "citation": citation,
        }
        for c in raw
    ]
    return envelope(
        result={"claims": claims, "claim_count": len(claims), "subject": subject},
        confidence=0.75 if claims else 0.3,
        reasoning=f"Extracted {len(claims)} claim(s) about '{subject}'.",
        evidence=[f"{c['predicate']}={c['value']}" for c in claims[:6]] or ["no structured claims found"],
        risk_level=RISK_NONE,
        recommended_next_action="compare-claims" if claims else "no-claims",
    )


def _guess_subject(text: str) -> str:
    m = re.search(r"\b(Saint|St\.?|Pope|Our Lady of|Blessed)\s+[A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+)*", text)
    return m.group(0).strip() if m else "unknown subject"


def normalize_claim(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise a claim's subject/predicate/value for comparison."""
    claim = require(payload, "claim")
    norm = {
        "subject": normalize_text(str(claim.get("subject", ""))),
        "predicate": normalize_text(str(claim.get("predicate", ""))),
        "value": normalize_text(str(claim.get("value", ""))),
    }
    key = f"{norm['subject']}|{norm['predicate']}"
    return envelope(
        result={"normalized": norm, "key": key},
        confidence=0.9,
        reasoning="Normalised claim for like-for-like comparison.",
        evidence=[key],
        risk_level=RISK_NONE,
        recommended_next_action="compare",
    )


def _group(claims: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for c in claims:
        key = f"{normalize_text(str(c.get('subject','')))}|{normalize_text(str(c.get('predicate','')))}"
        groups.setdefault(key, []).append(c)
    return groups


def _resolve_group(key: str, group: List[Dict[str, Any]]) -> Dict[str, Any]:
    values = {normalize_text(str(c.get("value", ""))) for c in group}
    agree = len(values) <= 1
    best = max(group, key=lambda c: authority_rank(str(c.get("authority_level", "COMMUNITY"))))
    losers = [
        c
        for c in group
        if normalize_text(str(c.get("value", ""))) != normalize_text(str(best.get("value", "")))
    ]
    decisive = best != losers[0] if losers else True
    highest = authority_rank(str(best.get("authority_level", "COMMUNITY")))
    loser_high = max((authority_rank(str(c.get("authority_level", "COMMUNITY"))) for c in losers), default=-1)
    needs_review = (not agree) and highest <= loser_high  # tie or no clear authority winner
    return {
        "key": key,
        "subject": group[0].get("subject"),
        "predicate": group[0].get("predicate"),
        "agreement": agree,
        "preferred_value": best.get("value"),
        "preferred_authority": best.get("authority_level"),
        "preferred_source": best.get("source"),
        "conflicting_values": sorted(values) if not agree else [],
        "decision": (
            "agree"
            if agree
            else ("block-lower-authority-pending-review" if not needs_review else "human-review-required")
        ),
        "requires_human_review": needs_review,
        "_decisive": decisive,
    }


def compare_claims(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Group claims by (subject,predicate), detect agreement/conflict, resolve."""
    claims = [c for c in (require(payload, "claims") or []) if isinstance(c, dict)]
    groups = _group(claims)
    resolutions = [_resolve_group(k, g) for k, g in groups.items()]
    conflicts = [r for r in resolutions if not r["agreement"]]
    needs_review = [r for r in resolutions if r["requires_human_review"]]
    risk = RISK_HIGH if needs_review else (RISK_MEDIUM if conflicts else RISK_NONE)
    return envelope(
        result={
            "resolutions": resolutions,
            "conflict_count": len(conflicts),
            "review_count": len(needs_review),
        },
        confidence=0.8 if claims else 0.3,
        reasoning=f"Compared {len(claims)} claim(s): {len(conflicts)} conflict(s), {len(needs_review)} need human review.",
        evidence=[
            f"{r['subject']}/{r['predicate']}: {'agree' if r['agreement'] else 'CONFLICT ' + str(r['conflicting_values'])}"
            for r in resolutions[:6]
        ]
        or ["no claims"],
        risk_level=risk,
        recommended_next_action="block-and-review" if needs_review else "publish-allowed",
        safe_to_auto_execute=not conflicts,
    )


def _conflict(payload: Dict[str, Any], predicate_filter, label: str) -> Dict[str, Any]:
    claims = [c for c in (require(payload, "claims") or []) if isinstance(c, dict)]
    filtered = [c for c in claims if predicate_filter(str(c.get("predicate", "")))]
    groups = _group(filtered)
    conflicts = [r for r in (_resolve_group(k, g) for k, g in groups.items()) if not r["agreement"]]
    return envelope(
        result={"conflicts": conflicts, "conflict_count": len(conflicts)},
        confidence=0.8 if filtered else 0.3,
        reasoning=f"{label}: {len(conflicts)} conflict(s) across {len(filtered)} claim(s).",
        evidence=[f"{c['subject']}/{c['predicate']}: {c['conflicting_values']}" for c in conflicts[:5]]
        or [f"no {label.lower()}"],
        risk_level=RISK_HIGH if conflicts else RISK_NONE,
        recommended_next_action="resolve-with-authority" if conflicts else "no-conflict",
    )


def detect_date_conflict(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _conflict(payload, lambda p: "year" in p or "date" in p or "day" in p, "Date conflict")


def detect_entity_conflict(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _conflict(payload, lambda p: p in ("entity", "patron", "founder", "location"), "Entity conflict")


def detect_title_conflict(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _conflict(payload, lambda p: "title" in p or "name" in p, "Title conflict")


def detect_liturgical_conflict(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _conflict(
        payload, lambda p: p in ("feast_day", "rank", "season", "color", "liturgical_color"), "Liturgical conflict"
    )


def resolve_claim_with_authority(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve a single (subject,predicate) group by Catholic authority."""
    claims = [c for c in (require(payload, "claims") or []) if isinstance(c, dict)]
    if not claims:
        return envelope(
            result={"resolution": None},
            confidence=0.2,
            reasoning="No claims to resolve.",
            risk_level=RISK_LOW,
            recommended_next_action="need-claims",
        )
    key = f"{claims[0].get('subject')}|{claims[0].get('predicate')}"
    res = _resolve_group(key, claims)
    return envelope(
        result={"resolution": res},
        confidence=0.85,
        reasoning=f"Resolved by authority → {res['preferred_value']} ({res['preferred_authority']}); {res['decision']}.",
        evidence=[f"winner={res['preferred_value']} via {res['preferred_authority']}"],
        risk_level=RISK_HIGH if res["requires_human_review"] else RISK_LOW,
        recommended_next_action="block-and-review" if res["requires_human_review"] else "accept-preferred",
        safe_to_auto_execute=res["agreement"],
    )


def build_claim_evidence_pack(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Assemble a reviewable evidence pack for a subject/predicate."""
    subject = str(require(payload, "subject"))
    predicate = str(opt(payload, "predicate", ""))
    claims = [c for c in (opt(payload, "claims", []) or []) if isinstance(c, dict)]
    relevant = [
        c
        for c in claims
        if normalize_text(str(c.get("subject", ""))) == normalize_text(subject)
        and (not predicate or normalize_text(str(c.get("predicate", ""))) == normalize_text(predicate))
    ]
    res = _resolve_group(f"{subject}|{predicate}", relevant) if relevant else None
    pack = {
        "subject": subject,
        "predicate": predicate,
        "claims": [
            {
                "value": c.get("value"),
                "source": c.get("source"),
                "authority_level": c.get("authority_level"),
                "citation": c.get("citation"),
            }
            for c in relevant
        ],
        "resolution": res,
    }
    return envelope(
        result={"evidence_pack": pack},
        confidence=0.8 if relevant else 0.3,
        reasoning=f"Built evidence pack for '{subject}' ({len(relevant)} claim(s)).",
        evidence=[f"{c.get('authority_level')}: {c.get('value')}" for c in relevant[:6]] or ["no relevant claims"],
        risk_level=RISK_HIGH if (res and res["requires_human_review"]) else RISK_NONE,
        recommended_next_action="review-evidence-pack",
        safe_to_auto_execute=False,
    )
