"""
Schema- and UI-awareness analysis.

TypeScript inspects the Prisma schema and the route/page tree (it owns the
filesystem); Python analyses the *summary* it passes in and returns findings +
structured developer requests. Deterministic and stdlib-only; it recommends, it
never edits code or schema.

Deep CODE awareness now lives in ``intelligence.operations.self_model`` (the
unified self-model), which replaced the old summary-only ``analyze_code``.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require


def _dev_request(kind: str, title: str, detail: str, severity: str, evidence: str = "") -> Dict[str, Any]:
    return {"kind": kind, "title": title, "detail": detail, "severity": severity, "evidence": evidence}


def analyze_schema(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Analyse a Prisma-schema summary for underused relations + gaps."""
    models = require(payload, "models")
    if not isinstance(models, list):
        models = []

    isolated: List[str] = []
    under_indexed: List[str] = []
    thin: List[str] = []
    for m in models:
        name = str(m.get("name") or "")
        fields = int(m.get("fields") or 0)
        relations = int(m.get("relations") or 0)
        indexes = int(m.get("indexes") or 0)
        if relations == 0:
            isolated.append(name)
        if fields >= 8 and indexes == 0:
            under_indexed.append(name)
        if fields <= 2:
            thin.append(name)

    requests: List[Dict[str, Any]] = []
    if under_indexed:
        requests.append(
            _dev_request(
                "schema",
                "Indexes for large unindexed models",
                f"{len(under_indexed)} model(s) have many fields but no @@index "
                f"(e.g. {', '.join(under_indexed[:5])}). Review for query hot-paths.",
                "medium",
                ", ".join(under_indexed[:10]),
            )
        )
    # Many isolated models can indicate underused relations (a graph the app
    # could connect). Only flag when it's a meaningful share.
    if len(isolated) >= max(3, len(models) // 4):
        requests.append(
            _dev_request(
                "schema",
                "Underused relations across models",
                f"{len(isolated)} model(s) declare no relations — the content graph may be "
                "thinner than the data supports. Review for relations worth modelling.",
                "low",
                ", ".join(isolated[:10]),
            )
        )

    findings = {
        "model_count": len(models),
        "isolated_models": isolated,
        "under_indexed_models": under_indexed,
        "thin_models": thin,
    }
    issues = len(under_indexed) + (1 if requests else 0)
    return envelope(
        result={"findings": findings, "developer_requests": requests},
        confidence=0.7 if models else 0.2,
        reasoning=(
            f"Analysed {len(models)} model(s): {len(isolated)} isolated, "
            f"{len(under_indexed)} large-but-unindexed, {len(thin)} thin."
        ),
        evidence=[r["title"] for r in requests] or ["no schema gaps surfaced"],
        risk_level=RISK_LOW if issues else RISK_NONE,
        recommended_next_action="review-schema-recommendations" if requests else "schema-healthy",
        safe_to_auto_execute=False,  # schema changes always require review
    )


def analyze_ui(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Analyse the route/page summary: are content types exposed in the UI?"""
    public_routes = [str(r).lower() for r in (opt(payload, "public_routes", []) or [])]
    admin_pages = [str(r) for r in (opt(payload, "admin_pages", []) or [])]
    content_types = [str(c) for c in (opt(payload, "content_types", []) or [])]

    # A content type is "exposed" if some public route path mentions it.
    def exposed(ct: str) -> bool:
        key = ct.lower().rstrip("s")
        return any(key in route for route in public_routes)

    unexposed = [ct for ct in content_types if not exposed(ct)]

    requests: List[Dict[str, Any]] = []
    if unexposed:
        requests.append(
            _dev_request(
                "ui",
                "Public pages for unexposed content types",
                f"{len(unexposed)} content type(s) have no obvious public route "
                f"({', '.join(unexposed[:6])}). Users can't browse them — add pages/links.",
                "medium",
                ", ".join(unexposed[:10]),
            )
        )

    findings = {
        "public_route_count": len(public_routes),
        "admin_page_count": len(admin_pages),
        "content_type_count": len(content_types),
        "unexposed_content_types": unexposed,
    }
    return envelope(
        result={"findings": findings, "developer_requests": requests},
        confidence=0.7 if content_types else 0.3,
        reasoning=(
            f"{len(public_routes)} public route(s), {len(admin_pages)} admin page(s); "
            f"{len(unexposed)} content type(s) appear unexposed."
        ),
        evidence=[r["title"] for r in requests] or ["UI exposes the known content types"],
        risk_level=RISK_LOW if requests else RISK_NONE,
        recommended_next_action="open-ui-tasks" if requests else "ui-healthy",
        safe_to_auto_execute=False,
    )



