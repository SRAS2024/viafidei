"""
Catholic authority graph.

Lets the brain reason about source authority, document authority, and which
sources may auto-publish. Deterministic + stdlib. Higher authority overrides
lower in claim resolution (see ``claims.py``). This replaces ad-hoc source
scoring with one shared authority model.
"""

from __future__ import annotations

from typing import Any, Dict, List
from urllib.parse import urlparse

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# Authority ladder (highest → lowest). Mirrors the Prisma SourceAuthorityLevel
# plus the Catholic document/role taxonomy the worker reasons over.
AUTHORITY_ORDER: List[str] = [
    "VATICAN",  # Holy See, Dicasteries, papal acts
    "CATECHISM",
    "LITURGICAL_BOOK",
    "USCCB",  # bishops' conferences
    "DIOCESAN",
    "RELIGIOUS_ORDER",
    "TRUSTED_PUBLISHER",
    "ACADEMIC",
    "COMMUNITY",
]
_RANK = {level: len(AUTHORITY_ORDER) - i for i, level in enumerate(AUTHORITY_ORDER)}

# Official / recognised hosts → authority level.
OFFICIAL_HOSTS: Dict[str, str] = {
    "vatican.va": "VATICAN",
    "press.vatican.va": "VATICAN",
    "usccb.org": "USCCB",
    "bible.usccb.org": "USCCB",
    "newadvent.org": "ACADEMIC",
    "gcatholic.org": "TRUSTED_PUBLISHER",
}

# Document-type → authority (canon of Catholic document weight).
DOCUMENT_AUTHORITY: Dict[str, str] = {
    "papal_bull": "VATICAN",
    "encyclical": "VATICAN",
    "apostolic_constitution": "VATICAN",
    "apostolic_exhortation": "VATICAN",
    "motu_proprio": "VATICAN",
    "apostolic_letter": "VATICAN",
    "dogmatic_definition": "VATICAN",
    "dogmatic_constitution": "VATICAN",
    "council_document": "VATICAN",
    "catechism_section": "CATECHISM",
    "canon_law": "VATICAN",
    "usccb_pastoral_letter": "USCCB",
    "diocesan_decree": "DIOCESAN",
}

# Communion / reliability red flags.
_REVIEW_FLAGS = (
    "old catholic",
    "independent catholic",
    "not in communion",
    "sedevacantist",
    "self-published",
    "blog",
)


def authority_rank(level: str) -> int:
    return _RANK.get(str(level).upper(), 0)


def _host(url: str) -> str:
    try:
        h = urlparse(url if "://" in url else f"https://{url}").hostname or ""
    except ValueError:
        h = ""
    return h[4:] if h.startswith("www.") else h


def _host_authority(host: str) -> str:
    if host in OFFICIAL_HOSTS:
        return OFFICIAL_HOSTS[host]
    # subdomain of an official host (e.g. press.vatican.va already mapped; catch others)
    for official, level in OFFICIAL_HOSTS.items():
        if host.endswith("." + official) or host == official:
            return level
    return ""


def build_catholic_authority_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return the authority ladder, official hosts, and document-authority map."""
    nodes = [{"level": lvl, "rank": _RANK[lvl]} for lvl in AUTHORITY_ORDER]
    return envelope(
        result={
            "authority_order": AUTHORITY_ORDER,
            "nodes": nodes,
            "official_hosts": OFFICIAL_HOSTS,
            "document_authority": DOCUMENT_AUTHORITY,
            "never_auto_publish": ["uncertain_communion", "repeated_contradiction", "review_only"],
        },
        confidence=0.9,
        reasoning=f"Catholic authority graph: {len(AUTHORITY_ORDER)} levels, {len(OFFICIAL_HOSTS)} official hosts, {len(DOCUMENT_AUTHORITY)} document types.",
        evidence=AUTHORITY_ORDER[:4],
        risk_level=RISK_NONE,
        recommended_next_action="rank-sources-against-graph",
    )


def rank_catholic_source_authority(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank sources by Catholic authority, flagging review-only sources."""
    sources = [s for s in (require(payload, "sources") or []) if isinstance(s, dict)]
    ranked: List[Dict[str, Any]] = []
    for s in sources:
        url = str(s.get("url") or "")
        host = _host(url)
        declared = str(s.get("authorityLevel") or "").upper()
        host_level = _host_authority(host)
        level = host_level or (declared if declared in _RANK else "COMMUNITY")
        text = f"{s.get('name','')} {url}".lower()
        review = [f for f in _REVIEW_FLAGS if f in text]
        contradictions = int(s.get("contradictions") or 0)
        extraction_failures = int(s.get("extractionFailures") or 0)
        auto_publish = (
            not review
            and contradictions < 2
            and extraction_failures < 3
            and authority_rank(level) >= _RANK["DIOCESAN"]
        )
        ranked.append(
            {
                "id": s.get("id"),
                "host": host,
                "authority_level": level,
                "rank": authority_rank(level),
                "may_auto_publish": auto_publish,
                "review_flags": review,
                "role": _role_for(level, host),
            }
        )
    ranked.sort(key=lambda r: r["rank"], reverse=True)
    blocked = [r for r in ranked if not r["may_auto_publish"]]
    return envelope(
        result={"ranked": ranked, "auto_publish_count": len(ranked) - len(blocked)},
        confidence=0.85 if sources else 0.3,
        reasoning=f"Ranked {len(ranked)} source(s) by Catholic authority; {len(blocked)} require review before publish.",
        evidence=[f"{r['host']}={r['authority_level']}" for r in ranked[:5]] or ["no sources"],
        risk_level=RISK_MEDIUM if blocked else RISK_LOW,
        recommended_next_action="route-review-sources" if blocked else "sources-ranked",
        safe_to_auto_execute=False,
    )


def _role_for(level: str, host: str) -> str:
    if level == "VATICAN":
        return "magisterial-primary"
    if level in ("CATECHISM", "LITURGICAL_BOOK"):
        return "magisterial-reference"
    if level in ("USCCB", "DIOCESAN"):
        return "episcopal"
    if level == "RELIGIOUS_ORDER":
        return "religious-order"
    if level in ("TRUSTED_PUBLISHER", "ACADEMIC"):
        return "secondary-reliable"
    return "community-review"


def resolve_authority_chain(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Order a set of authority levels from highest to lowest with the winner."""
    levels = [str(x).upper() for x in (require(payload, "levels") or [])]
    ordered = sorted(set(levels), key=lambda lvl: authority_rank(lvl), reverse=True)
    winner = ordered[0] if ordered else None
    return envelope(
        result={"ordered": ordered, "winner": winner, "ranks": {lvl: authority_rank(lvl) for lvl in ordered}},
        confidence=0.9 if ordered else 0.2,
        reasoning=f"Authority chain resolved; highest = {winner or 'n/a'}.",
        evidence=ordered[:5],
        risk_level=RISK_NONE,
        recommended_next_action="prefer-highest-authority",
    )


def classify_document_authority(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Map a Catholic document type to its authority level."""
    doc_type = str(require(payload, "document_type")).lower()
    level = DOCUMENT_AUTHORITY.get(doc_type, "TRUSTED_PUBLISHER")
    recognised = doc_type in DOCUMENT_AUTHORITY
    return envelope(
        result={"document_type": doc_type, "authority_level": level, "rank": authority_rank(level), "recognised": recognised},
        confidence=0.85 if recognised else 0.5,
        reasoning=f"Document '{doc_type}' → {level} authority.",
        evidence=[f"{doc_type}→{level}"],
        risk_level=RISK_NONE if recognised else RISK_LOW,
        recommended_next_action="apply-document-authority",
    )


def classify_source_role(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Classify a source's role in the Catholic graph (magisterial, episcopal, …)."""
    url = str(opt(payload, "url", ""))
    host = _host(url)
    declared = str(opt(payload, "authorityLevel", "")).upper()
    level = _host_authority(host) or (declared if declared in _RANK else "COMMUNITY")
    role = _role_for(level, host)
    return envelope(
        result={"host": host, "authority_level": level, "role": role, "may_auto_publish": role != "community-review"},
        confidence=0.8 if host else 0.4,
        reasoning=f"Source role: {role} ({level}).",
        evidence=[f"{host or 'unknown'}={role}"],
        risk_level=RISK_LOW if role == "community-review" else RISK_NONE,
        recommended_next_action="apply-source-role",
    )


def explain_authority_decision(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain why one source/level won over another."""
    chosen = str(opt(payload, "chosen", ""))
    over = [str(x) for x in (opt(payload, "over", []) or [])]
    cr = authority_rank(chosen)
    lines = [f"Chose {chosen} (rank {cr})."]
    for other in over:
        lines.append(
            f"Preferred over {other} (rank {authority_rank(other)}) because higher Catholic authority governs."
            if cr >= authority_rank(other)
            else f"NOTE: {other} actually has higher authority — review."
        )
    return envelope(
        result={"explanation": lines, "chosen": chosen, "rank": cr},
        confidence=0.85 if chosen else 0.3,
        reasoning="Explained the authority decision against the Catholic authority graph.",
        evidence=lines[:4],
        risk_level=RISK_HIGH if any("review" in line for line in lines) else RISK_NONE,
        recommended_next_action="authority-explained",
    )
