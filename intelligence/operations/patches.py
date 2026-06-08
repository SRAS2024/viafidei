"""
Review-gated self-improvement.

The worker can PROPOSE code/schema/test patches with a risk review and rollback
plan, but never applies or deploys them — every proposal is review-gated
(``safe_to_auto_execute`` is always False). Part of the unified intelligence
system, not a separate tool. Pure + stdlib.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, envelope, opt, require


def propose_code_patch(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Propose (not apply) a code change for a developer request."""
    req = require(payload, "request")
    files = [str(f) for f in (opt(payload, "affected_files", []) or [])]
    proposal = {
        "title": req.get("title"),
        "intent": req.get("detail", req.get("problem", "")),
        "affected_files": files,
        "approach": opt(payload, "approach", "minimal, focused change with new tests"),
        "tests_required": True,
        "requires_human_review": True,
        "must_not_self_deploy": True,
    }
    return envelope(
        result={"proposal": proposal},
        confidence=0.65,
        reasoning=f"Proposed a code patch for '{proposal['title']}' (human review required).",
        evidence=files[:6] or ["no files specified"],
        risk_level=RISK_MEDIUM,
        recommended_next_action="human-review-code-patch",
        safe_to_auto_execute=False,
    )


def propose_schema_migration(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Propose (not apply) a forward-only Prisma migration."""
    change = str(require(payload, "change"))
    models = [str(m) for m in (opt(payload, "affected_models", []) or [])]
    proposal = {
        "change": change,
        "affected_models": models,
        "forward_only": True,
        "backfill_required": bool(opt(payload, "backfill_required", False)),
        "tests_required": True,
        "requires_human_review": True,
    }
    return envelope(
        result={"proposal": proposal},
        confidence=0.6,
        reasoning=f"Proposed schema migration: {change} (human review required).",
        evidence=models[:6] or ["no models specified"],
        risk_level=RISK_HIGH,  # schema changes are always higher risk
        recommended_next_action="human-review-migration",
        safe_to_auto_execute=False,
    )


def review_patch_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Assess the risk of a proposed patch."""
    p = require(payload, "patch")
    files = [str(f) for f in (p.get("affected_files", []) or [])]
    touches_schema = bool(p.get("schema") or p.get("affected_models"))
    breadth = len(files)
    risk_score = min(1.0, 0.2 + 0.1 * breadth + (0.4 if touches_schema else 0.0))
    level = RISK_HIGH if risk_score >= 0.6 else RISK_MEDIUM if risk_score >= 0.35 else RISK_LOW
    factors: List[str] = []
    if touches_schema:
        factors.append("touches the database schema")
    if breadth > 5:
        factors.append(f"touches {breadth} files (wide blast radius)")
    if not p.get("tests_required", True):
        factors.append("no tests planned")
    return envelope(
        result={"risk_score": round(risk_score, 3), "factors": factors or ["narrow, tested change"]},
        confidence=0.75,
        reasoning=f"Patch risk {level} ({round(risk_score,2)}).",
        evidence=factors or ["low risk"],
        risk_level=level,
        recommended_next_action="generate-rollback-plan",
        safe_to_auto_execute=False,
    )


def generate_rollback_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a rollback plan for a proposed patch."""
    p = require(payload, "patch")
    schema = bool(p.get("schema") or p.get("affected_models"))
    steps = ["Revert the patch commit."]
    if schema:
        steps.append("Apply a forward-only down-migration (no destructive drop on populated columns).")
        steps.append("Verify data integrity before and after.")
    steps.append("Re-run the full test + verification suite.")
    return envelope(
        result={"rollback_plan": steps, "schema_involved": schema},
        confidence=0.8,
        reasoning="Generated a rollback plan for the proposed patch.",
        evidence=steps[:4],
        risk_level=RISK_LOW,
        recommended_next_action="attach-to-proposal",
        safe_to_auto_execute=False,
    )


def explain_patch_value(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Explain the value + cost of a proposed patch for a human reviewer."""
    p = require(payload, "patch")
    value = [
        f"Intelligence gain: {p.get('expected_gain', 'fewer recurring failures')}.",
        f"User value: {p.get('user_value', 'more complete / accurate content')}.",
        f"Risk if skipped: {p.get('risk_if_not_fixed', 'the failure keeps recurring')}.",
    ]
    return envelope(
        result={"value": value, "title": p.get("title")},
        confidence=0.75,
        reasoning="Explained the value and trade-offs of the patch.",
        evidence=value,
        risk_level=RISK_LOW,
        recommended_next_action="human-decide",
        safe_to_auto_execute=False,
    )
