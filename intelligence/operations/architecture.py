"""
Architecture governor — keeps the system unified, clean, and safe as it grows.

It enforces the architecture invariants (no competing intelligence paths, no old
fallback logic, no untested stage, no public type without a route, no model
without an owner, no critical decision without replayability, no sensitive
publish without proof, no new brain op without tests/contracts, no code patch
without human review, no benchmark regression ignored, …) over a structure
report TypeScript supplies, and surfaces drift to the admin dashboard.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# Each invariant: (id, description, the report key it checks, expected to be empty).
_INVARIANTS = [
    ("no_competing_paths", "No duplicate/competing intelligence paths.", "competingPaths"),
    ("no_old_fallback", "No old fallback logic competing with Python.", "legacyFallbacks"),
    ("no_untested_stage", "No untested worker stage.", "untestedStages"),
    ("route_for_public_type", "No public content type without a route.", "typesWithoutRoute"),
    ("model_ownership", "No schema model without ownership.", "unownedModels"),
    ("pipeline_verification", "No source pipeline without verification.", "unverifiedPipelines"),
    ("developer_request_evidence", "No developer request without evidence.", "evidencelessRequests"),
    ("mission_progress", "No mission without measurable progress.", "stagnantMissions"),
    ("decision_replayability", "No critical decision without replayability.", "nonReplayableDecisions"),
    ("sensitive_publish_proof", "No sensitive publish without proof.", "unprovenSensitivePublishes"),
    ("self_model_integration", "No code awareness without SelfModel integration.", "ungraphedModules"),
    ("op_tests", "No new brain operation without tests.", "untestedOps"),
    ("op_contracts", "No new brain operation without strict envelope contracts.", "uncontractedOps"),
    ("patch_review", "No production code patch without human review.", "unreviewedPatches"),
    ("migration_tests", "No schema migration without migration tests.", "untestedMigrations"),
    ("capability_gain", "No capability request without expected gain.", "gainlessCapabilities"),
    ("benchmark_regression", "No benchmark regression ignored.", "ignoredRegressions"),
    ("drift_visibility", "No unresolved architecture drift hidden from the dashboard.", "hiddenDrift"),
]


def _violations(report: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for rid, desc, key in _INVARIANTS:
        items = report.get(key, []) or []
        if items:
            out.append({"id": rid, "description": desc, "count": len(items),
                        "examples": list(items)[:3]})
    return out


def check_architecture_integrity(payload: Dict[str, Any]) -> Dict[str, Any]:
    report = require(payload, "report")
    if not isinstance(report, dict):
        report = {}
    violations = _violations(report)
    integrity = round(1.0 - len(violations) / len(_INVARIANTS), 3)
    return envelope(
        result={"integrity": integrity, "violations": violations, "clean": not violations,
                "checked": len(_INVARIANTS)},
        confidence=0.9,
        reasoning=(f"Architecture clean ({len(_INVARIANTS)} invariants)." if not violations
                   else f"{len(violations)} architecture violation(s): {[v['id'] for v in violations]}."),
        evidence=[v["id"] for v in violations[:5]] or ["clean"],
        risk_level=RISK_HIGH if violations else RISK_NONE,
        recommended_next_action="resolve-architecture-drift" if violations else "architecture-ok",
        safe_to_auto_execute=not violations,
    )


def detect_competing_paths(payload: Dict[str, Any]) -> Dict[str, Any]:
    report = opt(payload, "report", {}) or {}
    competing = list(report.get("competingPaths", []) or []) + list(report.get("legacyFallbacks", []) or [])
    return envelope(
        result={"competing_paths": competing, "found": bool(competing)},
        confidence=0.88,
        reasoning=(f"{len(competing)} competing/legacy path(s)." if competing
                   else "One unified intelligence path; no competitors."),
        evidence=competing[:5] or ["unified"],
        risk_level=RISK_HIGH if competing else RISK_NONE,
        recommended_next_action="remove-competing-path" if competing else "unified",
        safe_to_auto_execute=not competing,
    )


def detect_unowned_module(payload: Dict[str, Any]) -> Dict[str, Any]:
    report = opt(payload, "report", {}) or {}
    unowned = list(report.get("unownedModels", []) or []) + list(report.get("ungraphedModules", []) or [])
    return envelope(
        result={"unowned": unowned, "found": bool(unowned)},
        confidence=0.85,
        reasoning=(f"{len(unowned)} unowned/ungraphed module(s)." if unowned else "All modules owned."),
        evidence=unowned[:5] or ["owned"],
        risk_level=RISK_MEDIUM if unowned else RISK_NONE,
        recommended_next_action="assign-ownership" if unowned else "ok",
        safe_to_auto_execute=not unowned,
    )


def detect_unverified_stage(payload: Dict[str, Any]) -> Dict[str, Any]:
    report = opt(payload, "report", {}) or {}
    unverified = list(report.get("untestedStages", []) or []) + list(report.get("unverifiedPipelines", []) or [])
    return envelope(
        result={"unverified": unverified, "found": bool(unverified)},
        confidence=0.85,
        reasoning=(f"{len(unverified)} unverified stage/pipeline(s)." if unverified else "All stages verified."),
        evidence=unverified[:5] or ["verified"],
        risk_level=RISK_HIGH if unverified else RISK_NONE,
        recommended_next_action="add-stage-test" if unverified else "ok",
        safe_to_auto_execute=not unverified,
    )


def enforce_unified_brain_boundary(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Confirm the body/brain boundary: Python decides, TS executes; no second brain."""
    report = opt(payload, "report", {}) or {}
    second_brains = list(report.get("competingPaths", []) or [])
    ts_final_brains = list(report.get("legacyFallbacks", []) or [])
    ok = not second_brains and not ts_final_brains
    return envelope(
        result={"unified": ok, "second_brains": second_brains, "ts_final_brains": ts_final_brains},
        confidence=0.9,
        reasoning=("Unified-brain boundary holds: Python decides, TypeScript executes."
                   if ok else "Boundary breach: a competing decision path exists."),
        evidence=(second_brains + ts_final_brains)[:5] or ["boundary-intact"],
        risk_level=RISK_HIGH if not ok else RISK_NONE,
        recommended_next_action="remove-competing-path" if not ok else "boundary-ok",
        safe_to_auto_execute=ok,
    )


def generate_architecture_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    integ = check_architecture_integrity(payload)["result"]
    return envelope(
        result={"integrity": integ["integrity"], "violations": integ["violations"],
                "summary": ("clean" if integ["clean"] else f"{len(integ['violations'])} violation(s)"),
                "dashboard_visible": True},
        confidence=0.9,
        reasoning=f"Architecture report: integrity {integ['integrity']}.",
        evidence=[v["id"] for v in integ["violations"][:5]] or ["clean"],
        risk_level=RISK_HIGH if integ["violations"] else RISK_NONE,
        recommended_next_action="show-on-dashboard", safe_to_auto_execute=True,
    )
