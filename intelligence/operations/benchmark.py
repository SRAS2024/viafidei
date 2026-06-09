"""
Benchmark arena + brain-version comparison — every major upgrade is measured.

A fixed suite of intelligence tasks (the spec's 25) is scored; brain versions
are scored, compared, and checked for regression so the worker can *prove*
whether an upgrade made it better. Deterministic over the run results
TypeScript supplies; TS persists BenchmarkCase / BenchmarkRun / BrainVersionScore.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

BENCHMARK_TASKS = [
    "detect_exact_duplicate", "detect_fuzzy_duplicate", "detect_translated_duplicate",
    "avoid_false_duplicate", "detect_unsafe_source", "detect_uncertain_communion_risk",
    "extract_vatican_metadata", "extract_catechism_reference", "extract_canon_law_reference",
    "detect_missing_citation", "detect_conflicting_saint_dates", "resolve_apparition_conflict",
    "choose_best_next_action", "diagnose_failed_fetch", "diagnose_pdf_failure",
    "rank_developer_requests", "explain_growth_stop", "detect_route_gap",
    "detect_schema_gap", "detect_missing_tests", "prove_publish_eligibility",
    "prove_block_reason", "build_proof_packet", "assign_epistemic_status", "run_strategy_tournament",
]

# Version-quality metrics (the spec's brain-version comparison axes).
VERSION_METRICS = [
    "benchmark_score", "repair_success_rate", "duplicate_prevention_rate", "false_duplicate_rate",
    "source_authority_accuracy", "communion_risk_precision", "claim_verification_accuracy",
    "proof_packet_pass_rate", "publish_safety", "content_growth", "admin_correction_reduction",
    "developer_request_quality", "stuckness_reduction", "strategy_success", "test_coverage_improvement",
]
# Metrics where lower is better.
_LOWER_BETTER = {"false_duplicate_rate"}


def run_intelligence_benchmark(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Score a benchmark run; results = {task: pass_rate 0..1}."""
    results = opt(payload, "results", {}) or {}
    scored = {t: float(results.get(t, 0.0)) for t in BENCHMARK_TASKS}
    overall = round(sum(scored.values()) / len(BENCHMARK_TASKS), 4)
    weakest = sorted(scored.items(), key=lambda kv: kv[1])[:5]
    return envelope(
        result={"overall": overall, "task_count": len(BENCHMARK_TASKS),
                "weakest": [{"task": t, "score": round(s, 3)} for t, s in weakest]},
        confidence=0.85, reasoning=f"Benchmark overall {overall} across {len(BENCHMARK_TASKS)} tasks.",
        evidence=[f"{t}={round(s,2)}" for t, s in weakest[:3]],
        risk_level=RISK_NONE, recommended_next_action="rank-weakest-skills",
        safe_to_auto_execute=True,
    )


def rank_weakest_skills(payload: Dict[str, Any]) -> Dict[str, Any]:
    results = opt(payload, "results", {}) or {}
    scored = sorted(((t, float(results.get(t, 0.0))) for t in BENCHMARK_TASKS), key=lambda kv: kv[1])
    weak = [{"task": t, "score": round(s, 3)} for t, s in scored if s < 0.7][:8]
    return envelope(
        result={"weakest": weak, "count": len(weak)},
        confidence=0.85,
        reasoning=(f"{len(weak)} skill(s) below 0.7." if weak else "All skills ≥0.7."),
        evidence=[w["task"] for w in weak[:5]] or ["strong"],
        risk_level=RISK_MEDIUM if weak else RISK_NONE,
        recommended_next_action="recommend-training-focus" if weak else "benchmark-ok",
        safe_to_auto_execute=True,
    )


def _version_score(metrics: Dict[str, Any]) -> float:
    total = 0.0
    for m in VERSION_METRICS:
        v = float(metrics.get(m, 0.5))
        if m in _LOWER_BETTER:
            v = 1.0 - v
        total += v
    return round(total / len(VERSION_METRICS), 4)


def score_brain_version(payload: Dict[str, Any]) -> Dict[str, Any]:
    version = str(require(payload, "version"))
    metrics = opt(payload, "metrics", {}) or {}
    score = _version_score(metrics)
    return envelope(
        result={"version": version, "score": score, "metrics_used": len(VERSION_METRICS)},
        confidence=0.85, reasoning=f"Brain {version} scores {score}.",
        evidence=[f"score={score}"], risk_level=RISK_NONE,
        recommended_next_action="compare-brain-versions", safe_to_auto_execute=True,
    )


def compare_brain_versions(payload: Dict[str, Any]) -> Dict[str, Any]:
    a = require(payload, "version_a")  # {version, metrics}
    b = require(payload, "version_b")
    sa = _version_score(a.get("metrics", {}))
    sb = _version_score(b.get("metrics", {}))
    better = a.get("version") if sa >= sb else b.get("version")
    improvements, regressions = [], []
    for m in VERSION_METRICS:
        va = float(a.get("metrics", {}).get(m, 0.5))
        vb = float(b.get("metrics", {}).get(m, 0.5))
        delta = (va - vb)
        if m in _LOWER_BETTER:
            delta = -delta
        if delta > 0.03:
            improvements.append({"metric": m, "delta": round(delta, 3)})
        elif delta < -0.03:
            regressions.append({"metric": m, "delta": round(delta, 3)})
    return envelope(
        result={"version_a": a.get("version"), "score_a": sa, "version_b": b.get("version"),
                "score_b": sb, "better": better, "improvements": improvements, "regressions": regressions},
        confidence=0.85,
        reasoning=f"{a.get('version')} ({sa}) vs {b.get('version')} ({sb}); better: {better}.",
        evidence=[f"{a.get('version')}={sa}", f"{b.get('version')}={sb}"],
        risk_level=RISK_MEDIUM if regressions else RISK_NONE,
        recommended_next_action="explain-brain-improvement", safe_to_auto_execute=True,
    )


def detect_intelligence_regression(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Per-task regression between a baseline and a candidate benchmark run."""
    base = opt(payload, "baseline", {}) or {}
    cand = opt(payload, "candidate", {}) or {}
    regressed = []
    for t in BENCHMARK_TASKS:
        d = float(cand.get(t, 0.0)) - float(base.get(t, 0.0))
        if d < -0.05:
            regressed.append({"task": t, "delta": round(d, 3)})
    return envelope(
        result={"regression": bool(regressed), "regressed_tasks": regressed},
        confidence=0.85,
        reasoning=(f"{len(regressed)} task(s) regressed." if regressed else "No benchmark regression."),
        evidence=[r["task"] for r in regressed[:5]] or ["stable"],
        risk_level=RISK_HIGH if regressed else RISK_NONE,
        recommended_next_action="block-upgrade-adoption" if regressed else "safe-to-adopt",
        safe_to_auto_execute=not regressed,
    )


def detect_brain_regression(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Version-level regression: candidate overall below baseline overall."""
    cmp = compare_brain_versions(payload) if ("version_a" in payload and "version_b" in payload) else None
    if cmp:
        res = cmp["result"]
        regressed = res["score_b"] < res["score_a"] if res["better"] == res["version_a"] else False
        return envelope(
            result={"regression": bool(res["regressions"]) or regressed, "details": res["regressions"]},
            confidence=0.85,
            reasoning=("Version regression detected." if res["regressions"] else "No version regression."),
            evidence=[f"{r['metric']}={r['delta']}" for r in res["regressions"][:4]] or ["stable"],
            risk_level=RISK_HIGH if res["regressions"] else RISK_NONE,
            recommended_next_action="block-upgrade-adoption" if res["regressions"] else "safe-to-adopt",
            safe_to_auto_execute=not res["regressions"],
        )
    return detect_intelligence_regression(payload)


def explain_brain_improvement(payload: Dict[str, Any]) -> Dict[str, Any]:
    cmp = compare_brain_versions(payload)["result"]
    expl = (f"{cmp['better']} is better: improved on "
            + ", ".join(i["metric"] for i in cmp["improvements"][:3])
            + (f"; regressed on {', '.join(r['metric'] for r in cmp['regressions'][:2])}"
               if cmp["regressions"] else "") + ".")
    return envelope(
        result={"better": cmp["better"], "improvements": cmp["improvements"],
                "regressions": cmp["regressions"], "explanation": expl},
        confidence=0.82, reasoning=expl,
        evidence=[i["metric"] for i in cmp["improvements"][:4]] or ["no change"],
        risk_level=RISK_NONE, recommended_next_action="recommend-brain-upgrade",
        safe_to_auto_execute=True,
    )


def recommend_brain_upgrade(payload: Dict[str, Any]) -> Dict[str, Any]:
    cmp = compare_brain_versions(payload)["result"]
    adopt = cmp["score_b"] > cmp["score_a"] and not cmp["regressions"]
    return envelope(
        result={"recommend_adopt": adopt, "winner": cmp["better"],
                "blocking_regressions": cmp["regressions"]},
        confidence=0.85,
        reasoning=("Adopt the candidate — strictly better, no regressions (human review for code)."
                   if adopt else "Do not auto-adopt: no improvement or a regression is present."),
        evidence=[f"better={cmp['better']}"],
        risk_level=RISK_LOW if adopt else RISK_MEDIUM,
        recommended_next_action="open-review-gated-upgrade" if adopt else "hold",
        safe_to_auto_execute=False,  # code adoption is always human-reviewed
    )


def publish_benchmark_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    bench = run_intelligence_benchmark(payload)["result"]
    return envelope(
        result={"overall": bench["overall"], "weakest": bench["weakest"],
                "task_count": bench["task_count"], "report": "benchmark-report"},
        confidence=0.85, reasoning=f"Benchmark report: overall {bench['overall']}.",
        evidence=[f"overall={bench['overall']}"], risk_level=RISK_NONE,
        recommended_next_action="show-on-dashboard", safe_to_auto_execute=True,
    )
