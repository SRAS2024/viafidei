"""
Source intelligence: authority scoring, Catholic communion-risk
detection, and cross-source contradiction detection.

IMPORTANT FRAMING: communion-risk detection produces a *risk signal that
requires human verification*. It is NOT a doctrinal or canonical
judgement and must never be presented as one. Its only job is to stop the
worker from auto-publishing content from a source that *may* not be in
full communion with the Catholic Church (Rome) until a human verifies it.
When in doubt it raises risk and recommends review — the safe direction.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from ..contracts import (
    RISK_CRITICAL,
    RISK_HIGH,
    RISK_LOW,
    RISK_MEDIUM,
    RISK_NONE,
    envelope,
    max_risk,
    opt,
    require,
    risk_from_score,
)
from ..core import clamp, cosine, normalize_text, sparse_embed, str_ratio

# ── Communion-risk markers ───────────────────────────────────────────
# Phrases that may imply a body is NOT in full communion with Rome, or is
# of irregular/uncertain canonical status. Weighted by how strongly the
# phrase implies separation. These are screening signals only.
_RISK_MARKERS: List[Tuple[str, float, str]] = [
    (r"not in communion with rome", 0.9, "explicit-separation"),
    (r"independent of rome", 0.85, "explicit-separation"),
    (r"separated from rome", 0.85, "explicit-separation"),
    (r"catholic but not roman", 0.85, "explicit-separation"),
    (r"\bnot roman catholic\b", 0.7, "explicit-separation"),
    (r"old roman catholic", 0.8, "old-catholic"),
    (r"old catholic", 0.8, "old-catholic"),
    (r"union of utrecht", 0.8, "old-catholic"),
    (r"\butrecht union\b", 0.8, "old-catholic"),
    (r"independent catholic", 0.8, "independent"),
    (r"ecumenical catholic", 0.75, "independent"),
    (r"liberal catholic", 0.75, "independent"),
    (r"reformed catholic", 0.75, "independent"),
    (r"national catholic", 0.75, "national-church"),
    (r"polish national catholic", 0.8, "national-church"),
    (r"american (national )?catholic church", 0.7, "national-church"),
    (r"anglican catholic", 0.8, "anglican"),
    (r"anglo-?catholic", 0.6, "anglican"),
    (r"charismatic episcopal", 0.6, "convergence"),
    (r"\bconvergence (movement|church)\b", 0.5, "convergence"),
    (r"branch theory", 0.6, "ecclesiology"),
    (r"autocephalous", 0.6, "autocephalous"),
    (r"episcopi vagantes", 0.8, "vagantes"),
    (r"wandering bishop", 0.7, "vagantes"),
    (r"independent bishop", 0.7, "vagantes"),
    (r"self-?(ordained|consecrated)", 0.8, "vagantes"),
    (r"sedevacantis[mt]", 0.6, "irregular-canonical"),
    (r"society of (saint|st\.?) pius x", 0.45, "irregular-canonical"),
    (r"\bsspx\b", 0.45, "irregular-canonical"),
    (r"women priests?|woman priest|ordain(ed|ing)? women|priestess", 0.7, "noncanonical-practice"),
]

# "traditional catholic" is usually legitimate; flag only weakly on its
# own and let co-occurrence with independence markers raise it.
_SOFT_MARKERS: List[Tuple[str, float, str]] = [
    (r"traditional catholic", 0.18, "traditional"),
    (r"independent chapel", 0.4, "independent"),
    (r"no diocese|not affiliated with (any )?diocese", 0.45, "independent"),
    (r"continuing (anglican|church)", 0.6, "continuing"),
]

# ── Trust signals ────────────────────────────────────────────────────
_TRUST_MARKERS: List[Tuple[str, float, str]] = [
    # Negative lookbehind so "not in communion with Rome" is NOT read as a
    # trust signal (the phrase contains the substring "in communion with rome").
    (r"(?<!not )in (full )?communion with (rome|the (holy see|catholic church))", 0.8, "communion"),
    (r"holy see", 0.6, "vatican"),
    (r"\bvatican\b", 0.5, "vatican"),
    (r"roman curia|dicaster|congregation for", 0.5, "curia"),
    (r"imprimatur|nihil obstat", 0.6, "ecclesial-approval"),
    (r"united states conference of catholic bishops|usccb", 0.6, "conference"),
    (r"episcopal conference|conference of catholic bishops", 0.5, "conference"),
    (r"(arch)?diocese of|diocesan", 0.5, "diocese"),
    (r"\bparish (of|church)\b", 0.3, "parish"),
    (r"apostolic see|magisterium|catechism of the catholic church", 0.4, "magisterium"),
]

# Domains we treat as strongly trustworthy (official) or reliable.
_OFFICIAL_HOSTS = ("vatican.va", "usccb.org", "press.vatican.va")
_OFFICIAL_SUFFIXES = (".va",)
_OFFICIAL_FRAGMENTS = ("diocese", "archdiocese", "/diocesi", "vatican")
_RELIABLE_HOSTS = ("ewtn.com", "newadvent.org", "vaticannews.va", "catholicculture.org")


def _scan(text: str, markers: List[Tuple[str, float, str]]) -> List[Dict[str, Any]]:
    hits = []
    for pattern, weight, category in markers:
        m = re.search(pattern, text)
        if m:
            hits.append({"phrase": m.group(0), "weight": weight, "category": category})
    return hits


def _host(url: str) -> str:
    m = re.match(r"^[a-z]+://([^/]+)", url.strip(), re.IGNORECASE)
    host = (m.group(1) if m else "").lower()
    return host[4:] if host.startswith("www.") else host


def detect_communion_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Screen a source/institution for possible non-communion-with-Rome.

    Inputs: any of ``name``, ``description``, ``text``, ``url``.
    Output: communion_risk 0..1, matched flags, trust signals, verdict.
    """
    name = str(opt(payload, "name", ""))
    description = str(opt(payload, "description", ""))
    text = str(opt(payload, "text", ""))
    url = str(opt(payload, "url", ""))
    blob = normalize_text(" ".join([name, description, text]))
    host = _host(url)

    risk_hits = _scan(blob, _RISK_MARKERS)
    soft_hits = _scan(blob, _SOFT_MARKERS)
    trust_hits = _scan(blob, _TRUST_MARKERS)

    # Co-occurrence boost: "traditional"/soft markers matter more when an
    # independence/separation marker is also present.
    has_separation = any(h["category"] in {"independent", "explicit-separation", "old-catholic"} for h in risk_hits)
    soft_weight = 0.0
    for h in soft_hits:
        soft_weight += h["weight"] * (1.8 if has_separation else 1.0)

    risk_raw = sum(h["weight"] for h in risk_hits) + soft_weight
    trust_raw = sum(h["weight"] for h in trust_hits)

    # Official domains strongly mitigate (these are the trustworthy bodies
    # the spec calls out: Vatican, diocesan, episcopal conferences).
    official = (
        host in _OFFICIAL_HOSTS
        or host.endswith(_OFFICIAL_SUFFIXES)
        or any(frag in (host + " " + url.lower()) for frag in _OFFICIAL_FRAGMENTS)
    )
    reliable = host in _RELIABLE_HOSTS
    if official:
        trust_raw += 1.0
    elif reliable:
        trust_raw += 0.4

    communion_risk = clamp(risk_raw - 0.5 * trust_raw)
    # Even with markers, an official .va/diocesan domain caps the risk low.
    if official and not has_separation:
        communion_risk = min(communion_risk, 0.1)

    if communion_risk >= 0.6:
        verdict = "block-pending-verification"
        risk_level = max_risk(RISK_HIGH, risk_from_score(communion_risk))
        action = "block-and-seek-stronger-source"
    elif communion_risk >= 0.35:
        verdict = "draft-and-escalate"
        risk_level = RISK_MEDIUM
        action = "draft-only-and-escalate-for-review"
    elif communion_risk >= 0.15:
        verdict = "use-with-verification"
        risk_level = RISK_LOW
        action = "verify-before-publish"
    else:
        verdict = "no-communion-risk-detected"
        risk_level = RISK_NONE
        action = "proceed"

    flags = [f"{h['category']}: “{h['phrase']}”" for h in (risk_hits + soft_hits)]
    trust = [f"{h['category']}: “{h['phrase']}”" for h in trust_hits]
    if official:
        trust.append(f"official-domain: {host}")
    elif reliable:
        trust.append(f"reliable-domain: {host}")

    return envelope(
        result={
            "communion_risk": round(communion_risk, 4),
            "verdict": verdict,
            "flags": flags,
            "trust_signals": trust,
            "official_domain": official,
            "host": host or None,
        },
        # High confidence when we have a clear signal either way; muted in
        # the ambiguous middle band.
        confidence=clamp(0.55 + abs(communion_risk - 0.4) * 0.9),
        reasoning=(
            "Screened source text for phrases implying separation from / irregular "
            f"communion with Rome. communion_risk={communion_risk:.2f}. "
            "This is a verification flag, not a canonical ruling."
        ),
        evidence=(flags or ["no communion-risk phrases matched"]) + trust,
        sources_used=[url] if url else [],
        risk_level=risk_level,
        recommended_next_action=action,
        safe_to_auto_execute=False,  # communion calls always allow human override
    )


# ── Source authority scoring ─────────────────────────────────────────
_AUTHORITY_BY_LEVEL = {
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


def assess_source(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Score a source across the spec's dimensions and fold in communion risk."""
    source = require(payload, "source")
    url = str(source.get("url") or "")
    host = _host(url)
    text_blob = " ".join(
        str(source.get(k) or "") for k in ("name", "description", "text")
    )

    declared = str(source.get("authorityLevel") or "UNKNOWN").upper()
    authority = _AUTHORITY_BY_LEVEL.get(declared, 0.4)
    official = host in _OFFICIAL_HOSTS or host.endswith(_OFFICIAL_SUFFIXES) or "diocese" in host
    if official:
        authority = max(authority, 0.95)
    officialness = 0.95 if official else (0.6 if host in _RELIABLE_HOSTS else 0.4)

    failure_rate = clamp(float(source.get("failureRate") or 0.0))
    freshness_days = source.get("freshnessDays")
    if freshness_days is None:
        freshness = 0.6
    else:
        # Linear decay over ~3 years.
        freshness = clamp(1.0 - (float(freshness_days) / 1095.0))
    completeness = clamp(float(source.get("completeness") or 0.6))

    communion = detect_communion_risk(
        {
            "name": source.get("name"),
            "description": source.get("description"),
            "text": source.get("text"),
            "url": url,
        }
    )
    communion_risk = communion["result"]["communion_risk"]
    catholic_reliability = clamp((officialness * 0.6 + authority * 0.4) - communion_risk)
    doctrinal_safety = clamp(1.0 - communion_risk - (0.2 if not official and not (host in _RELIABLE_HOSTS) else 0.0))
    historical_trust = clamp((1.0 - failure_rate) * 0.7 + authority * 0.3)
    citation_usefulness = clamp(authority * 0.5 + completeness * 0.5)

    overall = clamp(
        0.22 * authority
        + 0.16 * officialness
        + 0.16 * catholic_reliability
        + 0.10 * freshness
        + 0.10 * completeness
        + 0.10 * historical_trust
        + 0.10 * doctrinal_safety
        + 0.06 * citation_usefulness
        - 0.5 * communion_risk
        - 0.3 * failure_rate
    )

    if communion_risk >= 0.6 or doctrinal_safety < 0.3:
        action, risk = "block-pending-verification", RISK_HIGH
        tier = "BLOCKED"
    elif overall >= 0.8 and communion_risk < 0.15:
        action, risk = "trust-for-auto-publish", RISK_LOW
        tier = "TRUSTED"
    elif overall >= 0.55:
        action, risk = "use-with-verification", RISK_MEDIUM
        tier = "RELIABLE"
    else:
        action, risk = "draft-only-and-escalate", RISK_MEDIUM
        tier = "SECONDARY"

    return envelope(
        result={
            "overall_score": round(overall, 4),
            "tier": tier,
            "subscores": {
                "authority": round(authority, 4),
                "officialness": round(officialness, 4),
                "catholic_reliability": round(catholic_reliability, 4),
                "freshness": round(freshness, 4),
                "completeness": round(completeness, 4),
                "historical_trust": round(historical_trust, 4),
                "doctrinal_safety": round(doctrinal_safety, 4),
                "citation_usefulness": round(citation_usefulness, 4),
                "failure_rate": round(failure_rate, 4),
                "communion_risk": round(communion_risk, 4),
            },
            "communion": communion["result"],
        },
        confidence=clamp(overall if action != "block-pending-verification" else communion["confidence"]),
        reasoning=(
            f"Source {host or url or 'source'} scored {overall:.2f} overall; "
            f"communion_risk={communion_risk:.2f}; tier={tier}."
        ),
        evidence=communion["evidence"],
        sources_used=[url] if url else [],
        risk_level=max_risk(risk, communion["risk_level"]),
        recommended_next_action=action,
        safe_to_auto_execute=(action == "trust-for-auto-publish"),
    )


# ── Cross-source comparison / contradiction detection ────────────────
_NUM_RE = re.compile(r"\b(\d{3,4})\b")  # years and counts


def compare_sources(payload: Dict[str, Any]) -> Dict[str, Any]:
    sources = require(payload, "sources")
    if not isinstance(sources, list) or len(sources) < 2:
        return envelope(
            result={"agreement": None, "contradictions": [], "ranked": []},
            confidence=0.2,
            reasoning="Need at least two sources to compare.",
            risk_level=RISK_LOW,
            recommended_next_action="gather-more-sources",
        )

    vecs = [(s, sparse_embed(str(s.get("text") or ""))) for s in sources]
    sims = []
    contradictions = []
    for i in range(len(vecs)):
        for j in range(i + 1, len(vecs)):
            (sa, va), (sb, vb) = vecs[i], vecs[j]
            sim = cosine(va, vb)
            sims.append(sim)
            nums_a = set(_NUM_RE.findall(str(sa.get("text") or "")))
            nums_b = set(_NUM_RE.findall(str(sb.get("text") or "")))
            # Same topic (high textual overlap) but disjoint key numbers ->
            # probable factual contradiction (e.g. different dates/years).
            if sim >= 0.5 and nums_a and nums_b and not (nums_a & nums_b):
                contradictions.append(
                    {
                        "a": sa.get("id"),
                        "b": sb.get("id"),
                        "similarity": round(sim, 3),
                        "a_values": sorted(nums_a)[:5],
                        "b_values": sorted(nums_b)[:5],
                        "summary": "Sources cover the same topic but cite different key figures/dates.",
                    }
                )

    agreement = sum(sims) / len(sims) if sims else 0.0

    def _rank_key(s: Dict[str, Any]) -> float:
        return (
            _AUTHORITY_BY_LEVEL.get(str(s.get("authorityLevel") or "UNKNOWN").upper(), 0.4)
            + 0.0001 * len(str(s.get("text") or ""))
        )

    ranked = sorted(
        [{"id": s.get("id"), "authority": str(s.get("authorityLevel") or "UNKNOWN"), "rank_score": round(_rank_key(s), 4)} for s in sources],
        key=lambda x: x["rank_score"],
        reverse=True,
    )

    if contradictions:
        risk, action = RISK_HIGH, "escalate-contradiction-for-review"
    elif agreement >= 0.6:
        risk, action = RISK_LOW, "proceed-sources-agree"
    else:
        risk, action = RISK_MEDIUM, "gather-more-sources"

    return envelope(
        result={
            "agreement": round(agreement, 4),
            "contradictions": contradictions,
            "ranked": ranked,
            "strongest_source": ranked[0]["id"] if ranked else None,
        },
        confidence=clamp(agreement if not contradictions else 1.0 - agreement),
        reasoning=(
            f"Compared {len(sources)} sources: mean pairwise similarity {agreement:.2f}; "
            f"{len(contradictions)} possible contradiction(s)."
        ),
        evidence=[c["summary"] for c in contradictions] or [f"mean agreement {agreement:.2f}"],
        sources_used=[str(s.get("id")) for s in sources if s.get("id")],
        risk_level=risk,
        recommended_next_action=action,
        safe_to_auto_execute=not contradictions and agreement >= 0.6,
    )
