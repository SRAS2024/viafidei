"""
Digital twin — a simulated Admin Worker environment for safe practice.

The brain rehearses decisions against simulated scenarios (source/PDF/dynamic
failures, duplicates, bad citations, contradictions, risky sources, missing
schema/route, admin rejection, verification failures, repair outcomes, mission
stagnation) without touching production. Pure + deterministic; TS persists
DigitalTwinScenario / DigitalTwinRun. It NEVER publishes or mutates real data.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require

# Scenario → (likely worker outcome, downstream effect) priors.
_SCENARIOS: Dict[str, Dict[str, Any]] = {
    "source_fetch_success": {"outcome": "advanced", "effect": "read created", "p": 0.95},
    "source_fetch_failure": {"outcome": "failed", "effect": "repair plan filed", "p": 0.9},
    "pdf_extraction_failure": {"outcome": "rejected", "effect": "missing fields", "p": 0.85},
    "dynamic_render_failure": {"outcome": "rejected", "effect": "little rendered text", "p": 0.8},
    "duplicate_content": {"outcome": "rejected", "effect": "blocked by duplicate gate", "p": 0.9},
    "bad_citations": {"outcome": "repair-planned", "effect": "citation repair", "p": 0.8},
    "contradictory_claims": {"outcome": "review", "effect": "human review queued", "p": 0.85},
    "risky_source": {"outcome": "blocked", "effect": "communion-risk block", "p": 0.9},
    "missing_schema_field": {"outcome": "review", "effect": "admin correction", "p": 0.8},
    "missing_route": {"outcome": "advanced", "effect": "content invisible", "p": 0.75},
    "admin_rejection": {"outcome": "rejected", "effect": "learning signal", "p": 0.95},
    "admin_correction": {"outcome": "repair-planned", "effect": "memory updated", "p": 0.9},
    "publish_verification_failure": {"outcome": "failed", "effect": "rollback", "p": 0.85},
    "cache_verification_failure": {"outcome": "failed", "effect": "cache repair", "p": 0.8},
    "sitemap_verification_failure": {"outcome": "failed", "effect": "sitemap repair", "p": 0.8},
    "repair_success": {"outcome": "advanced", "effect": "artifact recovered", "p": 0.85},
    "repair_failure": {"outcome": "rejected", "effect": "developer request", "p": 0.8},
    "human_review_queue_growth": {"outcome": "review", "effect": "backlog grows", "p": 0.9},
    "mission_stagnation": {"outcome": "idle", "effect": "switch mission", "p": 0.85},
    "developer_request_resolution": {"outcome": "advanced", "effect": "capability gained", "p": 0.9},
}


def create_worker_simulation(payload: Dict[str, Any]) -> Dict[str, Any]:
    scenarios = [s for s in (opt(payload, "scenarios", list(_SCENARIOS)) or []) if s in _SCENARIOS]
    if not scenarios:
        scenarios = list(_SCENARIOS)
    sim = {
        "id": "twin-" + str(opt(payload, "seed", "0")),
        "scenarios": scenarios,
        "isolated": True,
        "touches_production": False,
        "publishes": False,
    }
    return envelope(
        result=sim, confidence=0.9,
        reasoning=f"Digital twin created with {len(scenarios)} scenario(s); isolated from production.",
        evidence=scenarios[:5], risk_level=RISK_NONE,
        recommended_next_action="simulate-scenarios", safe_to_auto_execute=True,
    )


def _simulate_one(scenario: str) -> Dict[str, Any]:
    spec = _SCENARIOS.get(scenario, {"outcome": "unknown", "effect": "n/a", "p": 0.5})
    return {"scenario": scenario, "predicted_outcome": spec["outcome"],
            "downstream_effect": spec["effect"], "probability": spec["p"]}


def simulate_source_failure(payload: Dict[str, Any]) -> Dict[str, Any]:
    kind = str(opt(payload, "kind", "source_fetch_failure"))
    sims = [_simulate_one(k) for k in (kind, "pdf_extraction_failure", "dynamic_render_failure")]
    return envelope(
        result={"simulations": sims, "production_touched": False}, confidence=0.85,
        reasoning=f"Simulated source-failure family ({kind}).",
        evidence=[s["scenario"] for s in sims], risk_level=RISK_NONE,
        recommended_next_action="evaluate-twin-run", safe_to_auto_execute=True,
    )


def simulate_database_state(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Project a hypothetical DB state forward without mutating anything."""
    state = opt(payload, "state", {}) or {}
    published = int(state.get("published", 0))
    pending = int(state.get("pending", 0))
    projected = {"published": published + min(pending, 5), "pending": max(0, pending - 5),
                 "note": "projection only; no rows mutated"}
    return envelope(
        result={"current": state, "projected": projected, "production_touched": False},
        confidence=0.8, reasoning="Projected DB state forward (simulation only).",
        evidence=[f"published={published}->{projected['published']}"], risk_level=RISK_NONE,
        recommended_next_action="compare-simulated-vs-real", safe_to_auto_execute=True,
    )


def simulate_publish_pipeline(payload: Dict[str, Any]) -> Dict[str, Any]:
    artifact = opt(payload, "artifact", {}) or {}
    has_fields = bool(artifact.get("complete", artifact.get("missingFields", []) == []))
    safe = not artifact.get("sensitive") or artifact.get("proven")
    outcome = "published" if (has_fields and safe) else ("review" if not safe else "rejected")
    return envelope(
        result={"simulated_outcome": outcome, "published_for_real": False,
                "gates": {"completeness": has_fields, "safety": safe}},
        confidence=0.82,
        reasoning=f"Simulated publish pipeline → {outcome} (no real publish).",
        evidence=[f"complete={has_fields}", f"safe={safe}"], risk_level=RISK_NONE,
        recommended_next_action="evaluate-twin-run", safe_to_auto_execute=True,
    )


def simulate_admin_feedback(payload: Dict[str, Any]) -> Dict[str, Any]:
    action = str(opt(payload, "feedback", "correction"))
    learned = {"correction": "memory updated + quality weighting nudged",
               "rejection": "source reputation lowered",
               "approval": "source reputation raised"}.get(action, "no-op")
    return envelope(
        result={"feedback": action, "learning_signal": learned, "production_touched": False},
        confidence=0.8, reasoning=f"Simulated admin '{action}': {learned}.",
        evidence=[action], risk_level=RISK_NONE,
        recommended_next_action="apply-learning-in-twin", safe_to_auto_execute=True,
    )


def replay_worker_history(payload: Dict[str, Any]) -> Dict[str, Any]:
    history = [h for h in (opt(payload, "history", []) or []) if isinstance(h, dict)]
    reproduced = sum(1 for h in history if h.get("outcome") == _SCENARIOS.get(
        h.get("scenario", ""), {}).get("outcome", h.get("outcome")))
    rate = round(reproduced / len(history), 3) if history else 0.0
    return envelope(
        result={"replayed": len(history), "reproduced": reproduced, "fidelity": rate,
                "production_touched": False},
        confidence=0.8,
        reasoning=f"Replayed {len(history)} pass(es); twin fidelity {rate}.",
        evidence=[f"fidelity={rate}"], risk_level=RISK_NONE,
        recommended_next_action="compare-simulated-vs-real", safe_to_auto_execute=True,
    )


def compare_simulated_vs_real_outcome(payload: Dict[str, Any]) -> Dict[str, Any]:
    simulated = str(require(payload, "simulated"))
    real = str(require(payload, "real"))
    match = simulated == real
    return envelope(
        result={"match": match, "simulated": simulated, "real": real},
        confidence=0.85,
        reasoning=("Twin matched reality." if match else f"Twin diverged: {simulated} vs {real}."),
        evidence=[f"sim={simulated}", f"real={real}"],
        risk_level=RISK_LOW if not match else RISK_NONE,
        recommended_next_action="tune-twin-model" if not match else "twin-validated",
        safe_to_auto_execute=True,
    )
