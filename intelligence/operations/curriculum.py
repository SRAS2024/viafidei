"""
Self-generated curriculum — the worker trains itself on progressively harder
cases and measures where its skills plateau.

Generates graded training cases per skill, ranks them by difficulty, runs the
curriculum (scoring results), tracks skill progress, detects plateaus, and
recommends where to focus. Deterministic; TS persists CurriculumCase /
CurriculumRun.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require

# skill → graded levels (easy → hard), the spec's curriculum.
_CURRICULUM: Dict[str, List[str]] = {
    "duplicate_detection": ["exact", "fuzzy", "alternate_title", "translated_variant", "false_positive_avoidance"],
    "source_authority": ["obvious_official", "ambiguous", "hidden_separation"],
    "communion_risk": ["obvious_markers", "subtle_markers"],
    "claim_extraction": ["clean_text", "messy_text", "conflict_detection"],
    "liturgical": ["date_validation", "cycle_context"],
    "metadata": ["document_metadata", "vatican_metadata"],
    "reasoning": ["root_cause", "strategy_comparison", "proof_packet", "publish_eligibility_proof",
                  "test_gap_detection", "capability_invention"],
}


def generate_training_cases(payload: Dict[str, Any]) -> Dict[str, Any]:
    skill = str(opt(payload, "skill", "") or "")
    skills = [skill] if skill in _CURRICULUM else list(_CURRICULUM)
    cases = []
    for s in skills:
        for i, level in enumerate(_CURRICULUM[s]):
            cases.append({"skill": s, "level": level, "difficulty": round((i + 1) / len(_CURRICULUM[s]), 3)})
    return envelope(
        result={"cases": cases, "count": len(cases), "skills": skills},
        confidence=0.85, reasoning=f"Generated {len(cases)} training case(s).",
        evidence=[f"{c['skill']}:{c['level']}" for c in cases[:5]], risk_level=RISK_NONE,
        recommended_next_action="rank-training-difficulty", safe_to_auto_execute=True,
    )


def rank_training_difficulty(payload: Dict[str, Any]) -> Dict[str, Any]:
    cases = [c for c in (require(payload, "cases")) if isinstance(c, dict)]
    cases.sort(key=lambda c: float(c.get("difficulty", 0.5)))
    return envelope(
        result={"ordered": cases, "easiest": cases[0] if cases else None,
                "hardest": cases[-1] if cases else None},
        confidence=0.85, reasoning=f"Ranked {len(cases)} case(s) easy→hard.",
        evidence=[f"{c['skill']}:{c['level']}" for c in cases[:4]], risk_level=RISK_NONE,
        recommended_next_action="run-curriculum", safe_to_auto_execute=True,
    )


def run_curriculum(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Score curriculum results = {"skill:level": pass 0/1 or rate 0..1}."""
    results = opt(payload, "results", {}) or {}
    per_skill: Dict[str, List[float]] = {}
    for s, levels in _CURRICULUM.items():
        for level in levels:
            key = f"{s}:{level}"
            if key in results:
                per_skill.setdefault(s, []).append(float(results[key]))
    skill_scores = {s: round(sum(v) / len(v), 3) for s, v in per_skill.items() if v}
    overall = round(sum(skill_scores.values()) / len(skill_scores), 3) if skill_scores else 0.0
    return envelope(
        result={"skill_scores": skill_scores, "overall": overall, "skills_evaluated": len(skill_scores)},
        confidence=0.82, reasoning=f"Curriculum overall {overall} across {len(skill_scores)} skill(s).",
        evidence=[f"{s}={v}" for s, v in list(skill_scores.items())[:4]], risk_level=RISK_NONE,
        recommended_next_action="score-skill-progress", safe_to_auto_execute=True,
    )


def score_skill_progress(payload: Dict[str, Any]) -> Dict[str, Any]:
    prev = opt(payload, "previous", {}) or {}
    curr = require(payload, "current")
    deltas = []
    for s, v in (curr or {}).items():
        d = round(float(v) - float(prev.get(s, 0.0)), 3)
        deltas.append({"skill": s, "score": float(v), "delta": d})
    deltas.sort(key=lambda x: x["delta"])
    improved = [d for d in deltas if d["delta"] > 0.02]
    return envelope(
        result={"progress": deltas, "improved": [d["skill"] for d in improved],
                "regressed": [d["skill"] for d in deltas if d["delta"] < -0.02]},
        confidence=0.82, reasoning=f"{len(improved)} skill(s) improved.",
        evidence=[f"{d['skill']}{'+' if d['delta']>=0 else ''}{d['delta']}" for d in deltas[:4]],
        risk_level=RISK_NONE, recommended_next_action="identify-skill-plateau",
        safe_to_auto_execute=True,
    )


def identify_skill_plateau(payload: Dict[str, Any]) -> Dict[str, Any]:
    """A plateau = several recent runs with negligible change on a skill."""
    history = opt(payload, "history", {}) or {}  # {skill: [scores...]}
    plateaus = []
    for s, scores in history.items():
        vals = [float(x) for x in (scores or [])][-4:]
        if len(vals) >= 3 and (max(vals) - min(vals)) < 0.03 and sum(vals) / len(vals) < 0.85:
            plateaus.append({"skill": s, "level": round(sum(vals) / len(vals), 3)})
    return envelope(
        result={"plateaus": plateaus, "count": len(plateaus)},
        confidence=0.8,
        reasoning=(f"{len(plateaus)} skill(s) plateaued below mastery." if plateaus else "No plateaus."),
        evidence=[p["skill"] for p in plateaus[:4]] or ["progressing"],
        risk_level=RISK_MEDIUM if plateaus else RISK_NONE,
        recommended_next_action="recommend-training-focus" if plateaus else "continue",
        safe_to_auto_execute=True,
    )


def recommend_training_focus(payload: Dict[str, Any]) -> Dict[str, Any]:
    scores = opt(payload, "skill_scores", {}) or {}
    weak = sorted(((s, float(v)) for s, v in scores.items()), key=lambda kv: kv[1])
    focus = [s for s, v in weak if v < 0.8][:3]
    return envelope(
        result={"focus": focus, "rationale": "lowest-scoring skills with the most headroom"},
        confidence=0.82,
        reasoning=(f"Focus training on: {', '.join(focus)}." if focus else "Skills are strong; broaden difficulty."),
        evidence=[f"{s}={round(v,2)}" for s, v in weak[:4]],
        risk_level=RISK_NONE, recommended_next_action="generate-training-cases",
        safe_to_auto_execute=True,
    )
