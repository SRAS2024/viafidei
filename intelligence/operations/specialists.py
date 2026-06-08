"""
Internal specialist reviewers.

A panel of deterministic reviewers each scores a candidate decision/content and
returns {score, confidence, risk, evidence, recommendation, would_change_mind}.
``specialist_reviews`` runs the whole panel and combines them into one unified
decision envelope. Pure + stdlib.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require, risk_from_score
from ..core import clamp

SENSITIVE = {"APPARITION", "CHURCH_DOCUMENT", "SACRAMENT", "PRAYER", "DOCTOR", "POPE"}


def _r(name, score, confidence, risk, evidence, rec, change):
    return {
        "specialist": name,
        "score": round(clamp(score), 3),
        "confidence": round(clamp(confidence), 3),
        "risk": risk,
        "evidence": evidence,
        "recommendation": rec,
        "would_change_mind": change,
    }


def _planner(c: Dict[str, Any]) -> Dict[str, Any]:
    ev = float(c.get("finalScore", 0.5))
    return _r("planner", ev, 0.7, RISK_NONE, [f"expected value {round(ev,2)}"],
              "proceed" if ev >= 0.5 else "reconsider", "a higher-value action appearing")


def _skeptic(c: Dict[str, Any]) -> Dict[str, Any]:
    conf = float(c.get("confidence", 0.6))
    score = clamp(1.0 - abs(0.85 - conf))  # rewards calibrated, not over/under confident
    return _r("skeptic", score, 0.65, RISK_LOW if conf > 0.9 else RISK_NONE,
              [f"stated confidence {round(conf,2)}"], "verify before acting" if conf > 0.9 else "ok",
              "evidence contradicting the premise")


def _catholic_safety(c: Dict[str, Any]) -> Dict[str, Any]:
    sensitive = str(c.get("contentType", "")) in SENSITIVE
    risk = float(c.get("communionRisk", 0.0))
    # Sensitivity raises scrutiny (lower score, higher nominal risk band) but it
    # is NOT a blocker on its own — provenance, the communion screen and the
    # quality gate already cover sensitive types, so blocking every prayer/pope
    # would be wrong. Only a real communion-risk signal routes to review.
    score = clamp(1.0 - risk - (0.1 if sensitive else 0.0))
    return _r("catholic_safety", score, 0.8, risk_from_score(risk + (0.1 if sensitive else 0)),
              [f"communion risk {round(risk,2)}", f"sensitive={sensitive}"],
              "route to review" if risk > 0.3 else "safe",
              "a communion-risk flag or contradicting authority")


def _source_authority(c: Dict[str, Any]) -> Dict[str, Any]:
    rank = float(c.get("sourceAuthorityRank", 0.5))
    return _r("source_authority", rank, 0.75, RISK_LOW if rank < 0.4 else RISK_NONE,
              [f"authority rank {round(rank,2)}"], "prefer higher authority" if rank < 0.4 else "ok",
              "a higher-authority source")


def _duplicate(c: Dict[str, Any]) -> Dict[str, Any]:
    dup = float(c.get("duplicateScore", 0.0))
    return _r("duplicate", clamp(1.0 - dup), 0.75, risk_from_score(dup),
              [f"duplicate score {round(dup,2)}"], "block as duplicate" if dup > 0.8 else "ok",
              "a closer duplicate match")


def _completeness(c: Dict[str, Any]) -> Dict[str, Any]:
    comp = float(c.get("completeness", 0.7))
    return _r("content_completeness", comp, 0.7, RISK_LOW if comp < 0.6 else RISK_NONE,
              [f"completeness {round(comp,2)}"], "fill gaps" if comp < 0.6 else "ok",
              "missing required fields")


def _citation(c: Dict[str, Any]) -> Dict[str, Any]:
    n = int(c.get("citationCount", 0))
    return _r("citation", clamp(min(n, 2) / 2), 0.7, RISK_MEDIUM if n == 0 else RISK_NONE,
              [f"{n} citation(s)"], "require citations" if n == 0 else "ok", "losing a citation")


def _repair(c: Dict[str, Any]) -> Dict[str, Any]:
    rl = float(c.get("repairLikelihood", 0.3))
    return _r("repair_strategist", clamp(1 - rl), 0.65, risk_from_score(rl),
              [f"repair likelihood {round(rl,2)}"], "pre-empt repair" if rl > 0.5 else "ok",
              "a cheaper repair path")


def _maintainer(c: Dict[str, Any]) -> Dict[str, Any]:
    weak = bool(c.get("touchesWeakModule", False))
    return _r("codebase_maintainer", 0.5 if weak else 0.9, 0.6, RISK_LOW if weak else RISK_NONE,
              ["touches a weak module" if weak else "stable modules"],
              "add tests first" if weak else "ok", "the module gaining test coverage")


def _test_coverage(c: Dict[str, Any]) -> Dict[str, Any]:
    covered = bool(c.get("covered", True))
    return _r("test_coverage", 0.9 if covered else 0.4, 0.65, RISK_LOW if not covered else RISK_NONE,
              ["covered by tests" if covered else "no test coverage"],
              "add a test" if not covered else "ok", "a regression test being added")


def _security(c: Dict[str, Any]) -> Dict[str, Any]:
    susp = float(c.get("securitySuspicion", 0.0))
    return _r("security", clamp(1 - susp), 0.8, risk_from_score(susp),
              [f"suspicion {round(susp,2)}"], "block" if susp > 0.6 else "ok",
              "an injection/manipulation signal")


def _mission_progress(c: Dict[str, Any]) -> Dict[str, Any]:
    moves = bool(c.get("movesMissionForward", True))
    return _r("mission_progress", 0.85 if moves else 0.3, 0.7, RISK_NONE,
              ["advances a mission" if moves else "no mission progress"],
              "proceed" if moves else "pick a mission action", "the action advancing a mission")


_PANEL: List[Callable[[Dict[str, Any]], Dict[str, Any]]] = [
    _planner, _skeptic, _catholic_safety, _source_authority, _duplicate, _completeness,
    _citation, _repair, _maintainer, _test_coverage, _security, _mission_progress,
]


def specialist_reviews(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Run the full specialist panel over a candidate and combine into one decision."""
    candidate = require(payload, "candidate")
    reviews = [fn(candidate) for fn in _PANEL]
    return _combine(reviews)


def combine_specialist_reviews(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Combine externally-computed specialist reviews into one decision envelope."""
    reviews = [r for r in (require(payload, "reviews") or []) if isinstance(r, dict)]
    return _combine(reviews)


def _combine(reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not reviews:
        return envelope(result={"reviews": [], "decision": "abstain"}, confidence=0.2,
                        reasoning="No specialist reviews.", risk_level=RISK_LOW,
                        recommended_next_action="need-candidate")
    avg_score = sum(float(r.get("score", 0)) for r in reviews) / len(reviews)
    avg_conf = sum(float(r.get("confidence", 0)) for r in reviews) / len(reviews)
    blockers = [r for r in reviews if r.get("recommendation") in ("block", "block as duplicate", "route to review", "require citations")]
    worst = max((r.get("risk", RISK_NONE) for r in reviews), key=lambda x: ["none","low","medium","high","critical"].index(x) if x in ("none","low","medium","high","critical") else 0)
    decision = "block-or-review" if blockers else ("proceed" if avg_score >= 0.55 else "reconsider")
    return envelope(
        result={
            "reviews": reviews,
            "panel_score": round(avg_score, 3),
            "decision": decision,
            "blocking_specialists": [r["specialist"] for r in blockers],
        },
        confidence=round(clamp(avg_conf), 3),
        reasoning=f"Specialist panel ({len(reviews)}): score {round(avg_score,2)}, decision {decision}.",
        evidence=[f"{r['specialist']}: {r['recommendation']}" for r in reviews[:8]],
        risk_level=worst,
        recommended_next_action=decision,
        safe_to_auto_execute=(not blockers and avg_score >= 0.6 and worst in ("none", "low")),
    )
