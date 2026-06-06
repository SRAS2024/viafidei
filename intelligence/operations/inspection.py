"""
Self-inspection: failure-pattern recognition, structured developer
requests, and worker-IQ metrics.

These power the "developer report" the worker emits at the end of a major
run — completed/blocked work, failure patterns, and a *worker request
section* describing what the worker believes it needs to do its job
better (parsers, schema fields, sources, UI controls, safety rules…).
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import clamp, normalize_text

# Map limitation keywords -> a developer-request kind + a request template.
_REQUEST_RULES = [
    (r"dynamic|render|javascript|client-side|spa", "parser", "Dynamic-rendering fetcher",
     "Repeated failures fetching client-rendered pages; a headless/rendering fetcher is needed."),
    (r"pdf", "parser", "PDF extractor", "Sources are PDFs the current extractor cannot read."),
    (r"schema|field|column|relation|model", "schema", "Schema field/relation",
     "A recurring data pattern has no place to live; a schema field/relation is needed (review required)."),
    (r"source|domain|blocked|403|429|captcha", "source", "Source access / ranking",
     "A needed source is blocked or low-quality; alternate source access or a stronger ranking rule is needed."),
    (r"ui|display|admin|toggle|panel|screen|control", "ui", "Admin/UI control",
     "Data richness is not exposed; a UI/admin control or display is needed."),
    (r"communion|doctrine|verify|canonical|safety|gate", "safety", "Verification/safety rule",
     "A safer verification path is needed for a sensitive category before publishing."),
    (r"duplicate|merge", "capability", "Merge/dedupe capability",
     "Recurring duplicate situations need a merge/dedupe capability."),
    (r"test|regression|bug|typeerror|crash", "code", "Regression test / bug fix",
     "A recurring code defect needs a guard and a regression test (review required)."),
]


def _bucket(item: Dict[str, Any]) -> str:
    """A stable key to cluster a failure/limitation by."""
    cat = item.get("category")
    if cat:
        return str(cat)
    msg = normalize_text(str(item.get("message") or item.get("error") or item.get("detail") or ""))
    return " ".join(msg.split()[:6]) or "unknown"


def _derive_requests(patterns: List[Dict[str, Any]], blocked: List[Any]) -> List[Dict[str, Any]]:
    requests: List[Dict[str, Any]] = []
    seen = set()
    sources = [p["pattern"] for p in patterns] + [
        normalize_text(str(b.get("reason") or b.get("message") or b)) if isinstance(b, dict) else normalize_text(str(b))
        for b in blocked
    ]
    for text in sources:
        low = normalize_text(text)
        for pattern, kind, title, detail in _REQUEST_RULES:
            if re.search(pattern, low) and (kind, title) not in seen:
                seen.add((kind, title))
                requests.append(
                    {
                        "kind": kind,
                        "title": title,
                        "detail": detail,
                        "severity": "high" if kind in {"schema", "safety", "code"} else "medium",
                        "evidence": text[:160],
                    }
                )
    return requests


def self_inspect(payload: Dict[str, Any]) -> Dict[str, Any]:
    failures = opt(payload, "failures", [])
    blocked = opt(payload, "blocked", [])
    jobs = opt(payload, "jobs", [])
    failures = failures if isinstance(failures, list) else []
    blocked = blocked if isinstance(blocked, list) else []
    jobs = jobs if isinstance(jobs, list) else []

    counts = Counter(_bucket(f if isinstance(f, dict) else {"message": f}) for f in failures)
    patterns = [
        {"pattern": key, "count": n, "recommendation": "permanent-fix" if n >= 2 else "monitor"}
        for key, n in counts.most_common(12)
    ]
    repeated = [p for p in patterns if p["count"] >= 2]
    requests = _derive_requests(patterns, blocked)

    completed = sum(1 for j in jobs if isinstance(j, dict) and str(j.get("status")).upper() in {"DONE", "SUCCESS", "COMPLETED"})
    total = len(jobs)
    success_rate = (completed / total) if total else 0.0

    recommendations: List[str] = []
    if repeated:
        recommendations.append(f"{len(repeated)} repeated failure pattern(s) — apply permanent fixes instead of retrying.")
    if len(blocked) > 0:
        recommendations.append(f"{len(blocked)} blocked action(s) need an unblock decision or a capability.")
    if success_rate < 0.6 and total:
        recommendations.append(f"Job success rate is {success_rate:.0%} — investigate the dominant failure pattern.")
    if not recommendations:
        recommendations.append("No systemic issues detected this run.")

    report = {
        "summary": {
            "failures": len(failures),
            "blocked": len(blocked),
            "jobs": total,
            "completed": completed,
            "success_rate": round(success_rate, 3),
            "repeated_patterns": len(repeated),
        },
        "failure_patterns": patterns,
        "recommendations": recommendations,
        "developer_requests": requests,
    }
    risk = RISK_MEDIUM if (repeated or len(blocked) > 2) else (RISK_LOW if failures else RISK_NONE)
    return envelope(
        result=report,
        confidence=clamp(0.5 + 0.4 * (1.0 if patterns else 0.0)),
        reasoning=(
            f"Inspected {total} job(s), {len(failures)} failure(s), {len(blocked)} blocked action(s); "
            f"found {len(repeated)} repeated pattern(s) and {len(requests)} developer request(s)."
        ),
        evidence=[f"{p['pattern']} x{p['count']}" for p in repeated[:5]] or ["no repeated patterns"],
        risk_level=risk,
        recommended_next_action="emit-developer-report",
        safe_to_auto_execute=False,
    )


def developer_requests(payload: Dict[str, Any]) -> Dict[str, Any]:
    limitations = opt(payload, "limitations", [])
    failure_patterns = opt(payload, "failurePatterns", [])
    blocked = opt(payload, "blocked", [])
    patterns = []
    for item in (limitations if isinstance(limitations, list) else []) + (
        failure_patterns if isinstance(failure_patterns, list) else []
    ):
        if isinstance(item, dict):
            patterns.append({"pattern": str(item.get("pattern") or item.get("message") or item.get("detail") or "")})
        else:
            patterns.append({"pattern": str(item)})
    requests = _derive_requests(patterns, blocked if isinstance(blocked, list) else [])
    return envelope(
        result={"requests": requests, "count": len(requests)},
        confidence=clamp(0.4 + 0.1 * len(requests)),
        reasoning=f"Generated {len(requests)} structured developer request(s).",
        evidence=[f"{r['kind']}: {r['title']}" for r in requests[:5]] or ["no requests derived"],
        risk_level=RISK_LOW if requests else RISK_NONE,
        recommended_next_action="surface-in-developer-report",
        safe_to_auto_execute=False,
    )


def _delta(now_v: float, prev_v: float) -> float:
    return round(now_v - prev_v, 4)


def iq_metrics(payload: Dict[str, Any]) -> Dict[str, Any]:
    s = require(payload, "stats")
    if not isinstance(s, dict):
        s = {}

    def g(key: str, default: float = 0.0) -> float:
        try:
            return float(s.get(key, default))
        except (TypeError, ValueError):
            return default

    dup_candidates = g("duplicateCandidates")
    duplicates_prevented = g("duplicatesPrevented")
    repairs_attempted = g("repairsAttempted")
    repairs_succeeded = g("repairsSucceeded")

    metrics = {
        "autonomous_improvements": g("autonomousImprovements"),
        "prevented_bad_publishes": g("preventedBadPublishes"),
        "duplicate_prevention_rate": round(duplicates_prevented / dup_candidates, 4) if dup_candidates else 0.0,
        "avg_source_authority": round(g("avgSourceAuthority"), 4),
        "source_authority_growth": _delta(g("avgSourceAuthority"), g("sourceAuthorityPrev")),
        "content_quality_improvement": _delta(g("contentQualityNow"), g("contentQualityPrev")),
        "repair_success_rate": round(repairs_succeeded / repairs_attempted, 4) if repairs_attempted else 0.0,
        "relationship_richness_growth": _delta(g("relationshipsNow"), g("relationshipsPrev")),
        "failed_job_reduction": _delta(g("failedJobsPrev"), g("failedJobsNow")),
        "admin_correction_reduction": _delta(g("adminCorrectionsPrev"), g("adminCorrectionsNow")),
        "repeated_failure_reduction": _delta(g("repeatedFailuresPrev"), g("repeatedFailuresNow")),
        "learning_records": g("learningRecords"),
    }

    # A single 0..100 "worker IQ index": a normalised blend of the
    # effectiveness signals. Deliberately bounded and explainable.
    components = [
        clamp(metrics["duplicate_prevention_rate"]),
        clamp(metrics["repair_success_rate"]),
        clamp(metrics["avg_source_authority"]),
        clamp(0.5 + metrics["content_quality_improvement"]),
        clamp(0.5 + metrics["source_authority_growth"]),
        clamp(0.5 + 0.1 * metrics["failed_job_reduction"]),
        clamp(0.5 + 0.1 * metrics["admin_correction_reduction"]),
    ]
    iq_index = round(100.0 * (sum(components) / len(components)), 1)
    metrics["iq_index"] = iq_index

    return envelope(
        result={"metrics": metrics},
        confidence=0.7,
        reasoning=f"Computed worker-IQ metrics; IQ index = {iq_index}/100.",
        evidence=[
            f"dup_prevention={metrics['duplicate_prevention_rate']}",
            f"repair_success={metrics['repair_success_rate']}",
            f"quality_delta={metrics['content_quality_improvement']}",
        ],
        risk_level=RISK_NONE,
        recommended_next_action="display-on-intelligence-dashboard",
        safe_to_auto_execute=True,
    )
