"""
Knowledge extraction, content-structure intelligence, and variant
intelligence.

All three work over *sanitised* text TypeScript supplies and NEVER fabricate:
extraction only returns what is present in the text; variant detection only
proposes structural forms of a title (and explicitly flags that real
translations/alternate names must be verified against sources).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require
from ..core import normalize_text

# 3–4 digit years (so ancient dates like 354 / 430 are captured too); filtered
# to a plausible AD range in code. TypeScript validates extraction output.
_YEAR = re.compile(r"\b(\d{3,4})\b")
_FULLDATE = re.compile(
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2}(?:,\s*\d{4})?\b",
    re.IGNORECASE,
)
_SCRIPTURE = re.compile(
    r"\b(?:[1-3]\s?)?(?:Gen|Ex|Lev|Num|Deut|Josh|Judg|Ruth|Sam|Kings|Chron|Ezra|Neh|Tob|Jdt|"
    r"Esth|Job|Ps|Prov|Eccl|Song|Wis|Sir|Is|Isa|Jer|Lam|Bar|Ezek|Dan|Hos|Joel|Amos|Obad|Jon|"
    r"Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Mt|Matt|Mk|Mark|Lk|Luke|Jn|John|Acts|Rom|Cor|Gal|Eph|Phil|"
    r"Col|Thess|Tim|Tit|Phlm|Heb|Jas|Pet|Jude|Rev|Apoc)\.?\s?\d+(?::\d+(?:-\d+)?)?\b"
)
_URL = re.compile(r"https?://[^\s)\]]+")
_PERSON = re.compile(
    r"\b(?:Saint|St\.?|Pope|Blessed|Bl\.?|Venerable|Servant of God|Our Lady of)\s+"
    r"[A-Z][\w'’.-]+(?:\s+(?:of|the|de|di|da|von)?\s?[A-Z][\w'’.-]+){0,3}"
)
_CLAIM = re.compile(
    r"\b(is|was|were|are|founded|declared|canoniz|beatif|proclaim|born|died|"
    r"established|approved|composed|wrote|instituted)\b",
    re.IGNORECASE,
)


def _uniq(seq: List[str], limit: int) -> List[str]:
    seen: set = set()
    out: List[str] = []
    for x in seq:
        x = x.strip()
        if x and x not in seen:
            seen.add(x)
            out.append(x)
        if len(out) >= limit:
            break
    return out


def _sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def extract_knowledge(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(require(payload, "text"))
    limit = int(opt(payload, "max_items", 20))

    years = _uniq([y for y in _YEAR.findall(text) if 100 <= int(y) <= 2100], limit)
    full_dates = _uniq([m.group(0) for m in _FULLDATE.finditer(text)], limit)
    citations = _uniq(_SCRIPTURE.findall(text), limit)
    sources = _uniq(_URL.findall(text), limit)
    names = _uniq([m.group(0) for m in _PERSON.finditer(text)], limit)
    sentences = _sentences(text)
    summary = " ".join(sentences[:2])[:400]
    claims = _uniq([s for s in sentences if _CLAIM.search(s)], 10)
    # Heading-like lines: short, title-cased or ending with a colon.
    sections = _uniq(
        [
            ln.strip().rstrip(":")
            for ln in text.splitlines()
            if 0 < len(ln.strip()) <= 80 and (ln.strip().endswith(":") or ln.strip().istitle())
        ],
        12,
    )

    fields = {
        "dates": _uniq(full_dates + years, limit),
        "names": names,
        "citations": citations,
        "sources": sources,
        "summary": summary,
        "claims": claims,
        "sections": sections,
        "years": years,
    }
    nonempty = sum(1 for v in fields.values() if v)
    confidence = min(0.9, nonempty / 8.0 + 0.1) if text.strip() else 0.0

    return envelope(
        result=fields,
        confidence=confidence,
        reasoning=(
            f"Extracted {len(fields['dates'])} date(s), {len(names)} name(s), "
            f"{len(citations)} citation(s), {len(sources)} source link(s) from the supplied text."
        ),
        evidence=[f"{k}={len(v) if isinstance(v, list) else ('1' if v else '0')}" for k, v in fields.items()],
        risk_level=RISK_LOW,
        recommended_next_action="validate-and-store-extracted-data",
        safe_to_auto_execute=False,  # TypeScript validates + persists
    )


# Per-content-type ideal section layout for structure suggestions.
_SECTION_TEMPLATES: Dict[str, List[str]] = {
    "PRAYER": ["Text", "How to pray", "History", "Sources"],
    "NOVENA": ["Overview", "Day-by-day", "Closing prayer", "Sources"],
    "SAINT": ["Life", "Patronage", "Feast day", "Prayers", "Sources"],
    "POPE": ["Biography", "Pontificate", "Key writings", "Sources"],
    "DOCTOR": ["Life", "Teaching", "Key works", "Sources"],
    "APPARITION": ["Account", "Approval status", "Message", "Sources"],
    "CHURCH_DOCUMENT": ["Summary", "Key points", "Full text reference", "Sources"],
    "DEFAULT": ["Overview", "Details", "Sources"],
}


def suggest_structure(payload: Dict[str, Any]) -> Dict[str, Any]:
    record = require(payload, "record")
    ctype = str(record.get("contentType") or "DEFAULT").upper()
    body = str(record.get("body") or record.get("text") or "")
    existing = record.get("sections") if isinstance(record.get("sections"), list) else []

    paragraphs = [p for p in re.split(r"\n\s*\n", body) if p.strip()]
    template = _SECTION_TEMPLATES.get(ctype, _SECTION_TEMPLATES["DEFAULT"])
    missing_sections = [s for s in template if s.lower() not in {str(e).lower() for e in existing}]
    # A long body with no/few sections benefits from being split.
    split_recommended = len(body) > 1200 and len(existing) < 2 and len(paragraphs) >= 3

    confidence = 0.75 if (split_recommended or missing_sections) else 0.5
    return envelope(
        result={
            "content_type": ctype,
            "suggested_sections": template,
            "missing_sections": missing_sections,
            "split_recommended": split_recommended,
            "paragraphs": len(paragraphs),
        },
        confidence=confidence,
        reasoning=(
            f"{ctype}: {len(paragraphs)} paragraph(s), {len(existing)} existing section(s); "
            + ("recommend splitting into structured sections." if split_recommended else "structure looks adequate.")
        ),
        evidence=[f"missing_sections={missing_sections}"],
        risk_level=RISK_NONE,
        recommended_next_action="apply-structure-or-open-task" if (split_recommended or missing_sections) else "no-change",
        safe_to_auto_execute=False,
    )


def detect_variants(payload: Dict[str, Any]) -> Dict[str, Any]:
    title = str(require(payload, "title")).strip()
    known = {normalize_text(str(v)) for v in (opt(payload, "knownVariants", []) or [])}
    known.add(normalize_text(title))

    candidates: List[Dict[str, Any]] = []

    def add(form: str, kind: str, conf: float) -> None:
        form = form.strip()
        if form and normalize_text(form) not in known:
            known.add(normalize_text(form))
            candidates.append({"form": form, "kind": kind, "confidence": round(conf, 2)})

    # Structural-only variants (never translations — those need sources).
    if re.match(r"^St\.?\s", title, re.IGNORECASE):
        add(re.sub(r"^St\.?\s", "Saint ", title, flags=re.IGNORECASE), "expansion", 0.8)
    if re.match(r"^Saint\s", title, re.IGNORECASE):
        add(re.sub(r"^Saint\s", "St. ", title, flags=re.IGNORECASE), "abbreviation", 0.8)
    if title.lower().startswith("the "):
        add(title[4:], "article-dropped", 0.6)
    else:
        add(f"The {title}", "article-added", 0.4)
    words = [w for w in re.split(r"\s+", title) if w]
    if len(words) >= 2:
        acronym = "".join(w[0].upper() for w in words if w[0].isalpha())
        if len(acronym) >= 2:
            add(acronym, "acronym", 0.3)

    return envelope(
        result={"candidate_variants": candidates, "title": title},
        confidence=0.5 if candidates else 0.3,
        reasoning=(
            f"Proposed {len(candidates)} structural title variant(s). These are NOT translations or "
            "alternate names — those must be verified against trusted sources before storage."
        ),
        evidence=[f"{c['kind']}: {c['form']}" for c in candidates] or ["no structural variants"],
        risk_level=RISK_LOW,
        recommended_next_action="verify-variants-with-sources",
        safe_to_auto_execute=False,
    )
