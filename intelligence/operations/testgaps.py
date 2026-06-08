"""
Test-gap detection — turn repeated failures into test recommendations.

When the worker fails repeatedly, it identifies the test that should have caught
it and proposes a regression test (a review-gated patch plan, not an applied
change). Deterministic + stdlib.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# Failure signature → (test kind, fixture description).
_FAILURE_TO_TEST = {
    "pdf": ("PDF regression test", "a sample PDF fixture + expected extracted fields"),
    "dynamic": ("dynamic-rendering fixture test", "a JS-rendered page fixture + expected text"),
    "duplicate": ("duplicate-detection fixture test", "near-duplicate pair the slug check missed"),
    "communion": ("source-screening fixture test", "the false-positive source + expected verdict"),
    "publish": ("end-to-end route verification test", "publish → fetch public route → assert content"),
    "schema": ("Prisma validation test", "the mismatching payload + expected schema error"),
    "extract": ("extractor fixture test", "the source HTML + expected structured fields"),
    "fetch": ("fetch-retry fixture test", "the failing response + expected backoff/repair"),
    "qa": ("quality-scoring regression test", "the admin-corrected record + expected score"),
}


def _classify(text: str) -> str:
    t = text.lower()
    for key in _FAILURE_TO_TEST:
        if key in t:
            return key
    return "extract"


def detect_test_gap(payload: Dict[str, Any]) -> Dict[str, Any]:
    """From recurring failures, identify which tests are missing."""
    failures = [f for f in (require(payload, "failures") or []) if isinstance(f, dict)]
    counts: Dict[str, int] = {}
    for f in failures:
        key = _classify(f"{f.get('category','')} {f.get('error', f.get('message',''))}")
        counts[key] = counts.get(key, 0) + 1
    gaps = [
        {"failure_kind": k, "occurrences": n, "missing_test": _FAILURE_TO_TEST[k][0]}
        for k, n in counts.items()
        if n >= int(opt(payload, "min_occurrences", 2))
    ]
    gaps.sort(key=lambda g: g["occurrences"], reverse=True)
    return envelope(
        result={"test_gaps": gaps, "gap_count": len(gaps)},
        confidence=0.78 if failures else 0.3,
        reasoning=f"{len(gaps)} test gap(s) from {len(failures)} recurring failure(s).",
        evidence=[f"{g['failure_kind']} (×{g['occurrences']}) → {g['missing_test']}" for g in gaps[:6]]
        or ["no recurring failures"],
        risk_level=RISK_MEDIUM if gaps else RISK_NONE,
        recommended_next_action="suggest-regression-tests" if gaps else "coverage-ok",
        safe_to_auto_execute=False,
    )


def suggest_regression_test(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Suggest a regression test for one failure kind."""
    failure = str(require(payload, "failure"))
    key = _classify(failure)
    test_name, fixture = _FAILURE_TO_TEST[key]
    return envelope(
        result={
            "failure_kind": key,
            "test_name": test_name,
            "fixture": fixture,
            "assertion": "given the captured failing input, the pipeline now succeeds / blocks correctly",
        },
        confidence=0.8,
        reasoning=f"Suggested a {test_name} for '{key}' failures.",
        evidence=[test_name, fixture],
        risk_level=RISK_LOW,
        recommended_next_action="generate-test-fixture-plan",
        safe_to_auto_execute=False,
    )


def generate_test_fixture_plan(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Plan the fixtures + cases for a regression test (review-gated)."""
    key = _classify(str(require(payload, "failure")))
    test_name, fixture = _FAILURE_TO_TEST[key]
    plan = {
        "test_name": test_name,
        "fixtures": [fixture],
        "cases": [
            "the original failing input reproduces the bug on the OLD code",
            "the input is handled correctly on the NEW code",
            "an adjacent valid input still passes (no regression)",
        ],
        "location": "tests/ (TS) or intelligence/tests/ (Python) depending on the layer",
    }
    return envelope(
        result={"plan": plan},
        confidence=0.78,
        reasoning=f"Fixture plan for {test_name}.",
        evidence=plan["cases"],
        risk_level=RISK_NONE,
        recommended_next_action="propose-test-patch",
        safe_to_auto_execute=False,
    )


def propose_test_patch(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Propose (not apply) a regression-test patch outline for human review."""
    key = _classify(str(require(payload, "failure")))
    test_name, fixture = _FAILURE_TO_TEST[key]
    target = str(opt(payload, "target_file", "the affected module"))
    proposal = {
        "test_name": test_name,
        "target": target,
        "fixture": fixture,
        "outline": f"describe('{test_name}') → it('reproduces + fixes the {key} failure') with the captured input",
        "requires_human_review": True,
    }
    return envelope(
        result={"proposal": proposal},
        confidence=0.7,
        reasoning=f"Proposed a {test_name} patch outline (human-review required).",
        evidence=[proposal["outline"]],
        risk_level=RISK_LOW,
        recommended_next_action="human-review-test-patch",
        safe_to_auto_execute=False,
    )


def rank_missing_tests(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank missing tests by failure frequency × severity."""
    gaps = [g for g in (require(payload, "gaps") or []) if isinstance(g, dict)]
    ranked = sorted(
        (
            {
                "missing_test": g.get("missing_test"),
                "failure_kind": g.get("failure_kind"),
                "priority": int(g.get("occurrences", 1) or 1),
            }
            for g in gaps
        ),
        key=lambda x: x["priority"],
        reverse=True,
    )
    return envelope(
        result={"ranked": ranked, "top": ranked[0] if ranked else None},
        confidence=0.78 if gaps else 0.3,
        reasoning=f"Ranked {len(ranked)} missing test(s).",
        evidence=[f"{r['missing_test']} (×{r['priority']})" for r in ranked[:6]] or ["no gaps"],
        risk_level=RISK_LOW,
        recommended_next_action="add-top-missing-test" if ranked else "coverage-ok",
        safe_to_auto_execute=False,
    )
