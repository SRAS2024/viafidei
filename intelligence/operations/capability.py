"""
Capability invention — the worker invents the missing capabilities it needs,
not just a list of missing features.

A capability proposal is a complete, review-gated spec (problem, evidence,
expected gains, affected files/models/ops/stages, contracts, tests, migrations,
difficulty, risk, review requirement, rollback). The brain decomposes,
estimates, designs the contract + tests, ranks, and explains the need.
Deterministic; TS persists CapabilityProposal and routes it through human review.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# A library of known high-value capability templates (the spec's examples).
_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "three_path_pdf_extraction": {"problem": "Catholic PDFs fail extraction across text/scanned/table layouts.",
                                  "intel_gain": 0.6, "growth_gain": 0.7, "safety_gain": 0.2, "difficulty": 0.7},
    "vatican_metadata_extractor": {"problem": "Vatican document metadata is not extracted.",
                                   "intel_gain": 0.5, "growth_gain": 0.6, "safety_gain": 0.3, "difficulty": 0.5},
    "scanned_pdf_ocr_review": {"problem": "Scanned PDFs need an OCR + review path.",
                               "intel_gain": 0.4, "growth_gain": 0.5, "safety_gain": 0.4, "difficulty": 0.8},
    "liturgical_calendar_verifier": {"problem": "Liturgical claims aren't verified against the calendar.",
                                     "intel_gain": 0.5, "growth_gain": 0.4, "safety_gain": 0.6, "difficulty": 0.4},
    "apparition_status_classifier": {"problem": "Apparition approval status isn't classified.",
                                     "intel_gain": 0.5, "growth_gain": 0.3, "safety_gain": 0.7, "difficulty": 0.4},
    "source_authority_resolver": {"problem": "Source authority isn't resolved consistently.",
                                  "intel_gain": 0.6, "growth_gain": 0.4, "safety_gain": 0.6, "difficulty": 0.5},
    "catechism_paragraph_linker": {"problem": "Catechism references aren't linked to paragraphs.",
                                   "intel_gain": 0.5, "growth_gain": 0.4, "safety_gain": 0.3, "difficulty": 0.4},
    "canon_law_linker": {"problem": "Canon-law references aren't linked to canons.",
                         "intel_gain": 0.5, "growth_gain": 0.3, "safety_gain": 0.3, "difficulty": 0.4},
    "duplicate_translation_detector": {"problem": "Translated duplicate variants aren't detected.",
                                       "intel_gain": 0.6, "growth_gain": 0.3, "safety_gain": 0.5, "difficulty": 0.5},
}


def _proposal(name: str, t: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": name,
        "problem": t["problem"],
        "evidence_needed": ["repeated failures in this area", "developer requests referencing it"],
        "expected_intelligence_gain": t["intel_gain"],
        "expected_growth_gain": t["growth_gain"],
        "expected_safety_gain": t["safety_gain"],
        "affected_files": [f"src/lib/admin-worker/{name}.ts"],
        "affected_models": [],
        "affected_brain_ops": [],
        "affected_worker_stages": ["EXTRACTION", "STRICT_QA"],
        "required_contracts": [f"{name}Input", f"{name}Result"],
        "required_tests": [f"{name}.test.ts", f"test_{name}.py"],
        "required_migrations": [],
        "difficulty": t["difficulty"],
        "risk": round(0.3 + 0.4 * t["difficulty"], 3),
        "review_required": True,
        "rollback_plan": "feature-flag the path; revert the commit if benchmark regresses",
    }


def invent_capability(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(opt(payload, "name", "") or "")
    if name in _TEMPLATES:
        p = _proposal(name, _TEMPLATES[name])
    else:
        # Invent from a described problem.
        problem = str(require(payload, "problem"))
        slug = "_".join(problem.lower().split()[:4])
        p = _proposal(slug, {"problem": problem, "intel_gain": 0.5, "growth_gain": 0.4,
                             "safety_gain": 0.4, "difficulty": 0.6})
    return envelope(
        result=p, confidence=0.78,
        reasoning=f"Capability proposal '{p['name']}' (review-gated).",
        evidence=[p["problem"]], risk_level=RISK_MEDIUM,
        recommended_next_action="open-developer-request", safe_to_auto_execute=False,
    )


def decompose_capability(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(require(payload, "name"))
    steps = [
        {"step": "define strict input/result contracts", "owner": "brain+ts"},
        {"step": "implement the deterministic core", "owner": "ts"},
        {"step": "wire into the affected worker stage(s)", "owner": "ts"},
        {"step": "add unit + proof tests", "owner": "ts+brain"},
        {"step": "benchmark before/after", "owner": "brain"},
        {"step": "human review + merge", "owner": "human"},
    ]
    return envelope(
        result={"name": name, "steps": steps, "count": len(steps)},
        confidence=0.85, reasoning=f"Decomposed '{name}' into {len(steps)} steps.",
        evidence=[s["step"] for s in steps[:3]], risk_level=RISK_NONE,
        recommended_next_action="design-capability-contract", safe_to_auto_execute=True,
    )


def estimate_capability_gain(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(opt(payload, "name", ""))
    t = _TEMPLATES.get(name)
    if not t:
        t = {"intel_gain": float(opt(payload, "intel_gain", 0.5)),
             "growth_gain": float(opt(payload, "growth_gain", 0.4)),
             "safety_gain": float(opt(payload, "safety_gain", 0.4)),
             "difficulty": float(opt(payload, "difficulty", 0.6))}
    value = round((t["intel_gain"] + t["growth_gain"] + t["safety_gain"]) / 3, 3)
    roi = round(value / max(0.1, t["difficulty"]), 3)
    return envelope(
        result={"name": name, "value": value, "difficulty": t["difficulty"], "roi": roi},
        confidence=0.78, reasoning=f"'{name}' value {value}, difficulty {t['difficulty']}, ROI {roi}.",
        evidence=[f"roi={roi}"], risk_level=RISK_NONE,
        recommended_next_action="rank-new-capabilities", safe_to_auto_execute=True,
    )


def design_capability_contract(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(require(payload, "name"))
    return envelope(
        result={"name": name,
                "input_contract": {"type": "object", "required": ["payload"], "validatedBy": "zod (TS)"},
                "result_contract": {"envelope": "standard brain envelope",
                                    "fields": ["result", "confidence", "reasoning", "risk_level"]}},
        confidence=0.85, reasoning=f"Designed strict contracts for '{name}'.",
        evidence=["zod-validated"], risk_level=RISK_NONE,
        recommended_next_action="design-capability-tests", safe_to_auto_execute=True,
    )


def design_capability_tests(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(require(payload, "name"))
    tests = [f"{name}: happy path returns valid envelope",
             f"{name}: malformed input is rejected (BrainError)",
             f"{name}: safe_to_auto_execute is conservative",
             f"{name}: proof/benchmark regression guard"]
    return envelope(
        result={"name": name, "tests": tests, "count": len(tests)},
        confidence=0.85, reasoning=f"Designed {len(tests)} tests for '{name}'.",
        evidence=tests[:2], risk_level=RISK_NONE,
        recommended_next_action="open-developer-request", safe_to_auto_execute=True,
    )


def rank_new_capabilities(payload: Dict[str, Any]) -> Dict[str, Any]:
    names = opt(payload, "names", list(_TEMPLATES)) or list(_TEMPLATES)
    scored = []
    for n in names:
        t = _TEMPLATES.get(n)
        if not t:
            continue
        value = (t["intel_gain"] + t["growth_gain"] + t["safety_gain"]) / 3
        roi = round(value / max(0.1, t["difficulty"]), 3)
        scored.append({"name": n, "roi": roi, "value": round(value, 3)})
    scored.sort(key=lambda d: d["roi"], reverse=True)
    return envelope(
        result={"ranked": scored, "top": scored[0]["name"] if scored else None},
        confidence=0.8,
        reasoning=(f"Top capability by ROI: {scored[0]['name']}." if scored else "none"),
        evidence=[f"{d['name']}={d['roi']}" for d in scored[:4]], risk_level=RISK_NONE,
        recommended_next_action="invent-capability", safe_to_auto_execute=True,
    )


def explain_capability_need(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(require(payload, "name"))
    t = _TEMPLATES.get(name, {"problem": "addresses a recurring failure"})
    expl = (f"'{name}' is needed because {t['problem']} Resolving it is expected to raise "
            "intelligence, growth, and safety, and is routed through human review before any code lands.")
    return envelope(
        result={"name": name, "explanation": expl, "review_required": True},
        confidence=0.8, reasoning=expl, evidence=[t["problem"]], risk_level=RISK_LOW,
        recommended_next_action="open-developer-request", safe_to_auto_execute=False,
    )
