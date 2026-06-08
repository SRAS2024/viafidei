"""
Catholic content extraction intelligence.

Specialised, deterministic extractors for Via Fidei's content: document-type
identification, liturgical dates, canon-law / catechism references, papal &
council document metadata, saint / parish / prayer / novena / litany metadata,
and church-history timeline entries. Pure + stdlib (regex over sanitised text).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require

_YEAR = r"\b(\d{3,4})\b"
_CANON = re.compile(r"\bcanon\s+(\d{1,4})(?:\s*§\s*(\d+))?", re.I)
_CCC = re.compile(r"\b(?:CCC|Catechism)\s*(?:no\.?|nn?\.?|paragraph)?\s*(\d{1,4})", re.I)
_MONTH = "january|february|march|april|may|june|july|august|september|october|november|december"
_LITDATE = re.compile(rf"\b((?:{_MONTH})\s+\d{{1,2}})\b", re.I)

_DOC_SIGNATURES = [
    ("encyclical", re.compile(r"\bencyclical\b", re.I)),
    ("apostolic_exhortation", re.compile(r"\bapostolic exhortation\b", re.I)),
    ("apostolic_constitution", re.compile(r"\bapostolic constitution\b", re.I)),
    ("motu_proprio", re.compile(r"\bmotu proprio\b", re.I)),
    ("apostolic_letter", re.compile(r"\bapostolic letter\b", re.I)),
    ("council_document", re.compile(r"\b(?:ecumenical council|council of|vatican (?:i|ii)|lateran)\b", re.I)),
    ("catechism_section", re.compile(r"\bcatechism\b", re.I)),
    ("canon_law", re.compile(r"\b(?:code of canon law|canon \d)", re.I)),
    ("papal_bull", re.compile(r"\bpapal bull\b", re.I)),
]


def identify_document_type(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    for name, rx in _DOC_SIGNATURES:
        if rx.search(text):
            return envelope(
                result={"document_type": name, "recognised": True},
                confidence=0.8,
                reasoning=f"Identified document type: {name}.",
                evidence=[name],
                risk_level=RISK_NONE,
                recommended_next_action="extract-structured-document",
            )
    return envelope(
        result={"document_type": "vatican_document", "recognised": False},
        confidence=0.45,
        reasoning="No specific document signature; defaulting to generic document.",
        evidence=["no specific signature"],
        risk_level=RISK_LOW,
        recommended_next_action="review-document-type",
    )


def _all_years(text: str) -> List[str]:
    return [m.group(1) for m in re.finditer(_YEAR, text) if 100 <= int(m.group(1)) <= 2100]


def extract_structured_catholic_document(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    dtype = identify_document_type(payload)["result"]["document_type"]
    citations = re.findall(r"https?://[^\s)]+", text)
    canons = [m.group(1) for m in _CANON.finditer(text)]
    ccc = [m.group(1) for m in _CCC.finditer(text)]
    title_m = re.search(r"^([A-Z][A-Za-zÀ-ÿ' ]{3,80})", text.strip())
    return envelope(
        result={
            "document_type": dtype,
            "title": title_m.group(1).strip() if title_m else None,
            "years": _all_years(text)[:6],
            "canon_references": canons[:10],
            "catechism_references": ccc[:10],
            "citations": citations[:10],
        },
        confidence=0.7,
        reasoning=f"Extracted structured fields for a {dtype}.",
        evidence=[f"{len(canons)} canon ref(s)", f"{len(ccc)} CCC ref(s)", f"{len(citations)} citation(s)"],
        risk_level=RISK_NONE,
        recommended_next_action="validate-against-schema",
    )


def extract_liturgical_date(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    dates = [m.group(1) for m in _LITDATE.finditer(text)]
    return envelope(
        result={"liturgical_dates": dates[:8], "count": len(dates)},
        confidence=0.75 if dates else 0.4,
        reasoning=f"Found {len(dates)} liturgical date(s).",
        evidence=dates[:6] or ["no dates"],
        risk_level=RISK_NONE,
        recommended_next_action="map-to-calendar",
    )


def extract_canon_law_reference(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    refs = [{"canon": m.group(1), "section": m.group(2)} for m in _CANON.finditer(text)]
    return envelope(
        result={"canon_references": refs[:20], "count": len(refs)},
        confidence=0.8 if refs else 0.4,
        reasoning=f"Found {len(refs)} canon-law reference(s).",
        evidence=[f"can. {r['canon']}" for r in refs[:8]] or ["none"],
        risk_level=RISK_NONE,
        recommended_next_action="link-canons",
    )


def extract_catechism_reference(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    refs = [m.group(1) for m in _CCC.finditer(text)]
    return envelope(
        result={"catechism_references": refs[:20], "count": len(refs)},
        confidence=0.8 if refs else 0.4,
        reasoning=f"Found {len(refs)} Catechism reference(s).",
        evidence=[f"CCC {r}" for r in refs[:8]] or ["none"],
        risk_level=RISK_NONE,
        recommended_next_action="link-catechism",
    )


def _person_meta(payload: Dict[str, Any], kind: str, extra_keys: List[str]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    years = _all_years(text)
    feast = _LITDATE.search(text)
    meta: Dict[str, Any] = {"years": years[:4]}
    if feast:
        meta["feast_day"] = feast.group(1)
    for key, rx in extra_keys:
        m = rx.search(text)
        if m:
            meta[key] = m.group(1).strip()
    return envelope(
        result={"kind": kind, "metadata": meta},
        confidence=0.65,
        reasoning=f"Extracted {kind} metadata.",
        evidence=[f"{k}={v}" for k, v in list(meta.items())[:5]],
        risk_level=RISK_NONE,
        recommended_next_action="validate-against-schema",
    )


def extract_papal_document_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _person_meta(payload, "papal_document", [("pope", re.compile(r"Pope\s+([A-Z][\w' .]+)", re.I))])


def extract_council_document_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _person_meta(payload, "council_document", [("council", re.compile(r"(Council of [A-Z][\w' ]+|Vatican I+)", re.I))])


def extract_saint_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    return _person_meta(payload, "saint", [("patronage", re.compile(r"patron(?:\s+saint)? of ([A-Za-z, ]+)", re.I))])


def extract_parish_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    diocese = re.search(r"(Archdiocese|Diocese) of ([A-Z][\w' ]+)", text)
    designation = re.search(r"\b(cathedral|basilica|shrine|parish)\b", text, re.I)
    return envelope(
        result={
            "kind": "parish",
            "metadata": {
                "diocese": diocese.group(0) if diocese else None,
                "designation": designation.group(1).lower() if designation else "parish",
            },
        },
        confidence=0.65,
        reasoning="Extracted parish metadata.",
        evidence=[diocese.group(0) if diocese else "no diocese"],
        risk_level=RISK_NONE,
        recommended_next_action="validate-against-schema",
    )


def extract_prayer_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    is_litany = bool(re.search(r"\blitany\b|pray for us", text, re.I))
    return envelope(
        result={"kind": "prayer", "metadata": {"prayer_type": "litany" if is_litany else "general"}},
        confidence=0.7,
        reasoning="Extracted prayer metadata.",
        evidence=["litany" if is_litany else "general prayer"],
        risk_level=RISK_NONE,
        recommended_next_action="validate-against-schema",
    )


def extract_novena_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    days = len(re.findall(r"\bday\s+(?:one|two|three|four|five|six|seven|eight|nine|\d)\b", text, re.I))
    return envelope(
        result={"kind": "novena", "metadata": {"day_count": days, "is_nine_days": days == 9}},
        confidence=0.7,
        reasoning=f"Novena with {days} day marker(s).",
        evidence=[f"{days} days"],
        risk_level=RISK_LOW if days and days != 9 else RISK_NONE,
        recommended_next_action="validate-nine-days",
    )


def extract_litany_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    invocations = len(re.findall(r"pray for us|have mercy on us", text, re.I))
    return envelope(
        result={"kind": "litany", "metadata": {"invocation_count": invocations}},
        confidence=0.72,
        reasoning=f"Litany with {invocations} invocation(s).",
        evidence=[f"{invocations} invocations"],
        risk_level=RISK_NONE,
        recommended_next_action="validate-against-schema",
    )


def build_church_history_timeline_entry(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    years = _all_years(text)
    year = int(years[0]) if years else None
    title_m = re.search(r"^([A-Z][A-Za-zÀ-ÿ' ]{3,80})", text.strip())
    return envelope(
        result={
            "timeline_entry": {
                "year": year,
                "title": title_m.group(1).strip() if title_m else None,
                "summary": text[:200],
            }
        },
        confidence=0.7 if year else 0.4,
        reasoning=f"Built a church-history timeline entry ({year or 'no year'}).",
        evidence=[f"year={year}"],
        risk_level=RISK_NONE,
        recommended_next_action="place-on-timeline",
    )
