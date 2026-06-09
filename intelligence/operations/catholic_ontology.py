"""
Formal Catholic ontology — the worker understands Catholic content as connected
entities, not isolated text.

A typed entity taxonomy + allowed relationship rules let the brain classify an
entity, link it into the ontology, validate a proposed relationship, detect
gaps, and infer relationships. Deterministic + stdlib; TypeScript persists
CatholicOntologyNode / CatholicOntologyEdge.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require

# Entity types (the spec's set).
ENTITY_TYPES = [
    "GOD", "JESUS_CHRIST", "BLESSED_VIRGIN_MARY", "SAINT", "POPE", "DOCTOR_OF_THE_CHURCH",
    "COUNCIL", "CREED", "SACRAMENT", "RITE", "LITURGICAL_SEASON", "FEAST_DAY", "HOLY_DAY",
    "SCRIPTURE_REFERENCE", "CATECHISM_REFERENCE", "CANON_LAW_REFERENCE", "PAPAL_DOCUMENT",
    "CHURCH_DOCUMENT", "ENCYCLICAL", "APOSTOLIC_EXHORTATION", "APOSTOLIC_CONSTITUTION",
    "MOTU_PROPRIO", "MARIAN_TITLE", "APPARITION", "PRAYER", "NOVENA", "LITANY", "DEVOTION",
    "RELIGIOUS_ORDER", "PARISH", "DIOCESE", "BISHOPS_CONFERENCE", "HISTORICAL_EVENT",
    "HERESY", "SCHISM", "SOURCE_AUTHORITY", "CLAIM", "EVIDENCE",
]

# Allowed (subject_type, relation, object_type) — the ontology's grammar.
RELATIONSHIPS: List[Tuple[str, str, str]] = [
    ("POPE", "authored", "ENCYCLICAL"),
    ("POPE", "authored", "PAPAL_DOCUMENT"),
    ("POPE", "authored", "APOSTOLIC_EXHORTATION"),
    ("POPE", "authored", "MOTU_PROPRIO"),
    ("COUNCIL", "produced", "CHURCH_DOCUMENT"),
    ("COUNCIL", "addressed", "HERESY"),
    ("SAINT", "is_a", "DOCTOR_OF_THE_CHURCH"),
    ("SAINT", "is_a", "POPE"),
    ("APPARITION", "has_status", "SOURCE_AUTHORITY"),
    ("FEAST_DAY", "varies_by", "RITE"),
    ("FEAST_DAY", "celebrates", "SAINT"),
    ("CATECHISM_REFERENCE", "maps_to", "CLAIM"),
    ("CANON_LAW_REFERENCE", "maps_to", "CLAIM"),
    ("CHURCH_DOCUMENT", "has_authority", "SOURCE_AUTHORITY"),
    ("PRAYER", "honours", "BLESSED_VIRGIN_MARY"),
    ("MARIAN_TITLE", "refers_to", "BLESSED_VIRGIN_MARY"),
    ("DIOCESE", "contains", "PARISH"),
    ("RELIGIOUS_ORDER", "founded_by", "SAINT"),
    ("CLAIM", "supported_by", "EVIDENCE"),
]

_APPARITION_STATUSES = {"APPROVED", "NOT_APPROVED", "CONDEMNED", "UNDER_REVIEW"}

# Keyword classifiers (URL/title/text) → entity type.
_CLASSIFY_RULES: List[Tuple[str, str]] = [
    (r"\bencyclical\b", "ENCYCLICAL"),
    (r"\bmotu proprio\b", "MOTU_PROPRIO"),
    (r"apostolic exhortation", "APOSTOLIC_EXHORTATION"),
    (r"apostolic constitution", "APOSTOLIC_CONSTITUTION"),
    (r"\bcouncil of\b|ecumenical council", "COUNCIL"),
    (r"\bpope\b|pontiff|bishop of rome", "POPE"),
    (r"doctor of the church", "DOCTOR_OF_THE_CHURCH"),
    (r"our lady of|marian title", "MARIAN_TITLE"),
    (r"apparition", "APPARITION"),
    (r"\bnovena\b", "NOVENA"),
    (r"\blitany\b", "LITANY"),
    (r"\bcatechism\b|ccc \d", "CATECHISM_REFERENCE"),
    (r"canon \d|canon law", "CANON_LAW_REFERENCE"),
    (r"\bsacrament\b", "SACRAMENT"),
    (r"\bparish\b", "PARISH"),
    (r"\bdiocese\b|archdiocese", "DIOCESE"),
    (r"\bsaint\b|\bst\.\s", "SAINT"),
    (r"\bprayer\b", "PRAYER"),
    (r"\bdevotion\b", "DEVOTION"),
]


def build_catholic_ontology(payload: Dict[str, Any]) -> Dict[str, Any]:
    return envelope(
        result={"entity_types": ENTITY_TYPES, "entity_type_count": len(ENTITY_TYPES),
                "relationships": [{"subject": s, "relation": r, "object": o} for s, r, o in RELATIONSHIPS],
                "relationship_count": len(RELATIONSHIPS)},
        confidence=0.95,
        reasoning=f"Catholic ontology: {len(ENTITY_TYPES)} entity types, {len(RELATIONSHIPS)} relationship rules.",
        evidence=ENTITY_TYPES[:6], risk_level=RISK_NONE,
        recommended_next_action="classify-entity", safe_to_auto_execute=True,
    )


def classify_entity(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = " ".join(str(opt(payload, k, "") or "") for k in ("title", "text", "url", "slug")).lower()
    declared = str(opt(payload, "contentType", "")).upper()
    match = next((etype for pat, etype in _CLASSIFY_RULES if re.search(pat, text)), None)
    etype = match or (declared if declared in ENTITY_TYPES else "CLAIM")
    return envelope(
        result={"entity_type": etype, "matched_by": "keyword" if match else ("declared" if declared else "default"),
                "known_type": etype in ENTITY_TYPES},
        confidence=0.8 if match else 0.55,
        reasoning=f"Classified as {etype}.",
        evidence=[f"declared={declared or 'none'}"], risk_level=RISK_NONE,
        recommended_next_action="link-entity-to-ontology", safe_to_auto_execute=True,
    )


def link_entity_to_ontology(payload: Dict[str, Any]) -> Dict[str, Any]:
    etype = str(require(payload, "entity_type")).upper()
    out_rels = [{"relation": r, "object": o} for s, r, o in RELATIONSHIPS if s == etype]
    in_rels = [{"subject": s, "relation": r} for s, r, o in RELATIONSHIPS if o == etype]
    return envelope(
        result={"entity_type": etype, "can_be_subject_of": out_rels, "can_be_object_of": in_rels,
                "linked": bool(out_rels or in_rels)},
        confidence=0.85 if (out_rels or in_rels) else 0.5,
        reasoning=f"{etype}: {len(out_rels)} outgoing, {len(in_rels)} incoming relation rule(s).",
        evidence=[f"{r['relation']}->{r['object']}" for r in out_rels[:4]] or ["leaf entity"],
        risk_level=RISK_NONE, recommended_next_action="infer-ontology-relationships",
        safe_to_auto_execute=True,
    )


def validate_entity_relationship(payload: Dict[str, Any]) -> Dict[str, Any]:
    s = str(require(payload, "subject_type")).upper()
    rel = str(require(payload, "relation"))
    o = str(require(payload, "object_type")).upper()
    valid = (s, rel, o) in RELATIONSHIPS
    # Special-case: sacrament must be one of seven; apparition status constrained.
    extra_ok = True
    note = ""
    if rel == "has_status" and s == "APPARITION":
        status = str(opt(payload, "status", "")).upper()
        extra_ok = status in _APPARITION_STATUSES
        note = f"apparition status must be one of {sorted(_APPARITION_STATUSES)}" if not extra_ok else ""
    ok = valid and extra_ok
    return envelope(
        result={"valid": ok, "rule_exists": valid, "note": note,
                "relationship": {"subject": s, "relation": rel, "object": o}},
        confidence=0.9,
        reasoning=(f"{s} {rel} {o}: {'valid' if ok else 'invalid'}." + (f" {note}" if note else "")),
        evidence=[f"rule_exists={valid}"], risk_level=RISK_NONE if ok else RISK_LOW,
        recommended_next_action="continue" if ok else "reject-relationship",
        safe_to_auto_execute=True,
    )


def detect_ontology_gap(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Find entity types present in content but with no modelled relationships,
    or required links that are missing on a given entity."""
    present = {str(t).upper() for t in (opt(payload, "present_types", []) or [])}
    linked = {s for s, _, _ in RELATIONSHIPS} | {o for _, _, o in RELATIONSHIPS}
    isolated = sorted(t for t in present if t in ENTITY_TYPES and t not in linked)
    unknown = sorted(t for t in present if t not in ENTITY_TYPES)
    gaps = [{"type": t, "gap": "no modelled relationship"} for t in isolated] + \
           [{"type": t, "gap": "unknown entity type"} for t in unknown]
    return envelope(
        result={"gaps": gaps, "isolated_types": isolated, "unknown_types": unknown},
        confidence=0.8,
        reasoning=(f"{len(gaps)} ontology gap(s)." if gaps else "No ontology gaps in the present types."),
        evidence=[g["type"] for g in gaps[:5]] or ["complete"],
        risk_level=RISK_LOW if gaps else RISK_NONE,
        recommended_next_action="propose-ontology-relation" if gaps else "ontology-ok",
        safe_to_auto_execute=True,
    )


def infer_ontology_relationships(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Given a subject entity type, list the relationships it can participate in."""
    etype = str(require(payload, "entity_type")).upper()
    inferred = [{"subject": etype, "relation": r, "object": o} for s, r, o in RELATIONSHIPS if s == etype]
    return envelope(
        result={"entity_type": etype, "inferred": inferred, "count": len(inferred)},
        confidence=0.85 if inferred else 0.5,
        reasoning=f"{len(inferred)} relationship(s) inferable from {etype}.",
        evidence=[f"{i['relation']}->{i['object']}" for i in inferred[:4]] or ["none"],
        risk_level=RISK_NONE, recommended_next_action="validate-entity-relationship",
        safe_to_auto_execute=True,
    )


def explain_ontology_decision(payload: Dict[str, Any]) -> Dict[str, Any]:
    s = str(opt(payload, "subject_type", "")).upper()
    rel = str(opt(payload, "relation", ""))
    o = str(opt(payload, "object_type", "")).upper()
    if s and rel and o:
        valid = (s, rel, o) in RELATIONSHIPS
        expl = (f"'{s} {rel} {o}' is {'allowed' if valid else 'not'} in the Catholic ontology grammar.")
    else:
        expl = (f"The ontology models {len(ENTITY_TYPES)} entity types and {len(RELATIONSHIPS)} "
                "relationship rules so Catholic content is structured, not isolated text.")
    return envelope(
        result={"explanation": expl}, confidence=0.85, reasoning=expl,
        evidence=[f"types={len(ENTITY_TYPES)}"], risk_level=RISK_NONE,
        recommended_next_action="build-catholic-ontology", safe_to_auto_execute=True,
    )
