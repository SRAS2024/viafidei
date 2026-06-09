"""
Strategy tournament — generate multiple long-term strategies and compare them
before committing to a direction.

Each strategy is scored on the spec's dimensions (growth, source quality,
verification difficulty, Catholic safety risk, parser difficulty, repair
likelihood, user value, mission importance, test burden, maintainability,
schema/UI/route readiness, developer-request needs, time-to-completion). The
brain ranks them and explains why the winner beats the alternatives.
Deterministic; TypeScript persists StrategyCandidate / StrategyTournament.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require

# Higher is better unless the dimension is a cost (then we invert in scoring).
_COSTS = {"verification_difficulty", "catholic_safety_risk", "parser_difficulty",
          "test_burden", "time_to_completion", "developer_request_needs"}
_WEIGHTS = {
    "expected_growth": 1.3, "source_quality": 1.1, "user_value": 1.2, "mission_importance": 1.2,
    "repair_likelihood": 0.8, "maintainability": 0.9, "schema_readiness": 0.7,
    "ui_readiness": 0.6, "route_readiness": 0.7,
    "verification_difficulty": 1.0, "catholic_safety_risk": 1.4, "parser_difficulty": 0.9,
    "test_burden": 0.6, "time_to_completion": 0.8, "developer_request_needs": 0.6,
}

# Built-in candidate strategies (the spec's tournaments), each scored 0..1 per
# dimension. These are priors the brain reasons over; TS can supply its own.
_LIBRARY: Dict[str, Dict[str, float]] = {
    "vatican_documents_first": {"expected_growth": 0.7, "source_quality": 0.95, "user_value": 0.8,
                                "mission_importance": 0.9, "catholic_safety_risk": 0.3, "parser_difficulty": 0.7,
                                "repair_likelihood": 0.6, "verification_difficulty": 0.5, "route_readiness": 0.8},
    "catechism_first": {"expected_growth": 0.6, "source_quality": 0.95, "user_value": 0.85,
                        "mission_importance": 0.85, "catholic_safety_risk": 0.25, "parser_difficulty": 0.4,
                        "repair_likelihood": 0.7, "verification_difficulty": 0.4, "route_readiness": 0.7},
    "source_registry_first": {"expected_growth": 0.5, "source_quality": 0.9, "user_value": 0.5,
                              "mission_importance": 0.8, "catholic_safety_risk": 0.2, "parser_difficulty": 0.3,
                              "repair_likelihood": 0.8, "maintainability": 0.9, "schema_readiness": 0.8},
    "content_first": {"expected_growth": 0.85, "source_quality": 0.6, "user_value": 0.8,
                      "mission_importance": 0.7, "catholic_safety_risk": 0.5, "parser_difficulty": 0.6,
                      "repair_likelihood": 0.5, "verification_difficulty": 0.6},
    "official_sources_only": {"expected_growth": 0.5, "source_quality": 0.98, "user_value": 0.75,
                              "mission_importance": 0.8, "catholic_safety_risk": 0.15, "verification_difficulty": 0.4,
                              "repair_likelihood": 0.7},
    "official_plus_trusted": {"expected_growth": 0.8, "source_quality": 0.8, "user_value": 0.8,
                              "mission_importance": 0.8, "catholic_safety_risk": 0.45, "verification_difficulty": 0.6,
                              "repair_likelihood": 0.6},
    "improve_parser_first": {"expected_growth": 0.65, "source_quality": 0.7, "user_value": 0.6,
                             "mission_importance": 0.7, "catholic_safety_risk": 0.3, "parser_difficulty": 0.2,
                             "repair_likelihood": 0.85, "test_burden": 0.7},
}


def _score(dims: Dict[str, float]) -> float:
    total = 0.0
    wsum = 0.0
    for dim, w in _WEIGHTS.items():
        v = float(dims.get(dim, 0.5))
        if dim in _COSTS:
            v = 1.0 - v  # cost → benefit
        total += w * v
        wsum += w
    return round(total / wsum, 4) if wsum else 0.0


def _candidates(payload: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
    supplied = opt(payload, "strategies", None)
    if isinstance(supplied, dict) and supplied:
        return {k: dict(v) for k, v in supplied.items() if isinstance(v, dict)}
    if isinstance(supplied, list) and supplied:
        return {str(s.get("name", i)): dict(s.get("dimensions", s))
                for i, s in enumerate(supplied) if isinstance(s, dict)}
    names = opt(payload, "names", None)
    if isinstance(names, list) and names:
        return {n: _LIBRARY[n] for n in names if n in _LIBRARY}
    return dict(_LIBRARY)


def generate_candidate_strategies(payload: Dict[str, Any]) -> Dict[str, Any]:
    cands = _candidates(payload)
    return envelope(
        result={"strategies": sorted(cands.keys()), "count": len(cands),
                "dimensions": sorted(_WEIGHTS.keys())},
        confidence=0.85, reasoning=f"{len(cands)} candidate strategies.",
        evidence=sorted(cands.keys())[:5], risk_level=RISK_NONE,
        recommended_next_action="run-strategy-tournament", safe_to_auto_execute=True,
    )


def simulate_strategy(payload: Dict[str, Any]) -> Dict[str, Any]:
    name = str(require(payload, "name"))
    dims = opt(payload, "dimensions", _LIBRARY.get(name, {})) or {}
    score = _score(dims)
    return envelope(
        result={"name": name, "score": score, "dimensions": dims},
        confidence=0.78, reasoning=f"Strategy '{name}' composite score {score}.",
        evidence=[f"score={score}"], risk_level=RISK_NONE,
        recommended_next_action="rank-strategy", safe_to_auto_execute=True,
    )


def run_strategy_tournament(payload: Dict[str, Any]) -> Dict[str, Any]:
    cands = _candidates(payload)
    ranked = sorted(({"name": n, "score": _score(d)} for n, d in cands.items()),
                    key=lambda r: r["score"], reverse=True)
    winner = ranked[0] if ranked else None
    margin = round(ranked[0]["score"] - ranked[1]["score"], 4) if len(ranked) > 1 else 0.0
    return envelope(
        result={"ranked": ranked, "winner": winner["name"] if winner else None, "margin": margin},
        confidence=0.82,
        reasoning=(f"Winner '{winner['name']}' ({winner['score']}), margin {margin}." if winner else "No strategies."),
        evidence=[f"{r['name']}={r['score']}" for r in ranked[:4]],
        risk_level=RISK_NONE, recommended_next_action="explain-winning-strategy",
        safe_to_auto_execute=True,
    )


def rank_strategy(payload: Dict[str, Any]) -> Dict[str, Any]:
    return run_strategy_tournament(payload)


def explain_winning_strategy(payload: Dict[str, Any]) -> Dict[str, Any]:
    cands = _candidates(payload)
    ranked = sorted(({"name": n, "score": _score(d), "dims": d} for n, d in cands.items()),
                    key=lambda r: r["score"], reverse=True)
    if not ranked:
        return envelope(result={"explanation": "no strategies"}, confidence=0.4,
                        reasoning="no strategies", risk_level=RISK_NONE,
                        recommended_next_action="generate-candidate-strategies", safe_to_auto_execute=True)
    win = ranked[0]
    # Why it wins: the dimensions where it leads the runner-up most.
    edges = []
    if len(ranked) > 1:
        run = ranked[1]["dims"]
        for dim in _WEIGHTS:
            wv = float(win["dims"].get(dim, 0.5))
            rv = float(run.get(dim, 0.5))
            adv = (rv - wv) if dim in _COSTS else (wv - rv)
            if adv > 0.05:
                edges.append({"dimension": dim, "advantage": round(adv, 3)})
        edges.sort(key=lambda e: e["advantage"], reverse=True)
    expl = (f"'{win['name']}' wins ({win['score']}) chiefly on "
            + ", ".join(e["dimension"] for e in edges[:3]) + ".") if edges else f"'{win['name']}' wins."
    return envelope(
        result={"winner": win["name"], "score": win["score"], "winning_dimensions": edges[:5],
                "explanation": expl},
        confidence=0.82, reasoning=expl,
        evidence=[f"{e['dimension']}+{e['advantage']}" for e in edges[:3]],
        risk_level=RISK_NONE, recommended_next_action="store-strategy-result",
        safe_to_auto_execute=True,
    )


def store_strategy_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    winner = str(require(payload, "winner"))
    score = float(opt(payload, "score", 0.0))
    return envelope(
        result={"stored": True, "winner": winner, "score": score,
                "decision": f"adopt mission direction: {winner}"},
        confidence=0.8, reasoning=f"Recorded tournament winner '{winner}'.",
        evidence=[f"score={score}"], risk_level=RISK_NONE,
        recommended_next_action="set-mission-direction", safe_to_auto_execute=True,
    )
