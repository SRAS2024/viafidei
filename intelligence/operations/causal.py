"""
Causal Intelligence Core — the brain reasons about *why* things happen.

Beyond detecting that a stage failed, the worker traces the causal chain: which
upstream factor produced a symptom, what downstream blocker it created, and the
single intervention most likely to fix it. Deterministic + stdlib: a curated
causal model of the Via Fidei pipeline (cause → effect edges with a mechanism,
a base strength, and the intervention that breaks the edge) is reasoned over
together with the live signals TypeScript supplies. ``update_causal_model``
adjusts edge strength from observed outcomes; TypeScript persists the result to
the CausalGraph / CausalFactor store.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, BrainError, envelope, opt, require


# A causal edge: cause factor → effect factor, with the mechanism, a base
# strength (0..1 prior), and the intervention that most directly breaks it.
class _Edge:
    __slots__ = ("cause", "effect", "mechanism", "strength", "intervention")

    def __init__(self, cause: str, effect: str, mechanism: str, strength: float, intervention: str):
        self.cause = cause
        self.effect = effect
        self.mechanism = mechanism
        self.strength = strength
        self.intervention = intervention

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cause": self.cause,
            "effect": self.effect,
            "mechanism": self.mechanism,
            "strength": round(self.strength, 3),
            "intervention": self.intervention,
        }


# The curated causal model of the worker pipeline (the spec's chains + more).
_MODEL: List[_Edge] = [
    _Edge("source_type", "extraction_difficulty",
          "Some source classes (scanned PDF, dynamic HTML, table-heavy) are intrinsically harder to parse.",
          0.7, "route the source class to a dedicated extraction path / parser"),
    _Edge("extraction_difficulty", "missing_fields",
          "When extraction is hard, required fields are not recovered.",
          0.75, "add a per-type extractor or fall back to a higher-authority source"),
    _Edge("missing_fields", "strict_qa_failure",
          "Artifacts missing required fields fail the strict-QA gate.",
          0.85, "file a field-level repair plan before QA"),
    _Edge("strict_qa_failure", "publish_delay",
          "Failing strict QA holds the artifact out of the publish path.",
          0.8, "repair the failing dimension, then re-run strict QA"),
    _Edge("publish_delay", "mission_stagnation",
          "Nothing publishing means the mission's content count does not grow.",
          0.7, "switch mission stage / content type to unblock growth"),
    _Edge("mission_stagnation", "developer_request",
          "Sustained stagnation surfaces a developer request for the missing capability.",
          0.6, "resolve the highest-leverage developer request"),
    _Edge("missing_parser", "repair_failure",
          "Without a parser for the source class, repair plans keep re-failing the same way.",
          0.8, "invent the missing parser capability (review-gated)"),
    _Edge("schema_gap", "admin_corrections",
          "A missing schema field forces the admin to correct the same thing repeatedly.",
          0.75, "propose a schema migration (human-reviewed) to close the gap"),
    _Edge("weak_route_coverage", "content_invisible",
          "Content exists in the DB but has no public route, so it is never seen or indexed.",
          0.8, "add the public route + sitemap entry for the content type"),
    _Edge("weak_tests", "regressions",
          "Untested stages regress silently when nearby code changes.",
          0.7, "add a regression test for the untested stage"),
    _Edge("secondary_sources", "low_quality",
          "Secondary sources lower citation depth and authority, depressing quality scores.",
          0.65, "prefer official/higher-authority sources for the type"),
    _Edge("missing_calendar_context", "liturgical_failure",
          "Liturgical content without the year/cycle context cannot be validated.",
          0.7, "supply liturgical-calendar context (season, cycle, date) to the verifier"),
]

# Terminal effects that are observable symptoms (used to anchor root-cause walks).
_SYMPTOMS = {
    "strict_qa_failure", "publish_delay", "mission_stagnation", "developer_request",
    "repair_failure", "admin_corrections", "content_invisible", "regressions",
    "low_quality", "liturgical_failure", "missing_fields",
}


def _edges_into(effect: str) -> List[_Edge]:
    return [e for e in _MODEL if e.effect == effect]


def _edges_from(cause: str) -> List[_Edge]:
    return [e for e in _MODEL if e.cause == cause]


def _signal_weight(signals: Dict[str, Any], factor: str) -> float:
    """How active a factor is right now (0..1), from TS-supplied signals."""
    if not isinstance(signals, dict):
        return 1.0
    raw = signals.get(factor)
    if raw is None:
        return 1.0  # unknown → don't suppress
    try:
        val = float(raw)
    except (TypeError, ValueError):
        return 1.0 if raw else 0.0
    if val <= 0:
        return 0.0
    return min(1.0, val / 5.0 + 0.2)  # any activity registers; saturates at 5


def build_causal_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return the causal graph (factors + weighted edges), optionally weighted
    by the live ``signals`` TypeScript supplies so active edges stand out."""
    signals = opt(payload, "signals", {}) or {}
    factors = sorted({e.cause for e in _MODEL} | {e.effect for e in _MODEL})
    edges = []
    for e in _MODEL:
        active = _signal_weight(signals, e.cause) * _signal_weight(signals, e.effect)
        d = e.to_dict()
        d["activation"] = round(active, 3)
        edges.append(d)
    edges.sort(key=lambda d: d["activation"] * d["strength"], reverse=True)
    return envelope(
        result={"factors": factors, "edges": edges, "edge_count": len(edges)},
        confidence=0.85,
        reasoning=f"Causal graph: {len(factors)} factors, {len(edges)} edges.",
        evidence=[f"{e['cause']}->{e['effect']}" for e in edges[:5]],
        risk_level=RISK_NONE,
        recommended_next_action="explain-root-cause",
        safe_to_auto_execute=True,
    )


def infer_causal_factors(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Given an observed effect, infer the immediate upstream causal factors."""
    effect = str(require(payload, "effect"))
    signals = opt(payload, "signals", {}) or {}
    parents = _edges_into(effect)
    if not parents:
        return envelope(
            result={"effect": effect, "factors": []},
            confidence=0.4,
            reasoning=f"No known upstream factor for '{effect}'.",
            evidence=[f"effect={effect}"],
            risk_level=RISK_LOW,
            recommended_next_action="extend-causal-model",
            safe_to_auto_execute=True,
        )
    ranked = sorted(
        ({"factor": e.cause, "mechanism": e.mechanism,
          "likelihood": round(e.strength * _signal_weight(signals, e.cause), 3),
          "intervention": e.intervention} for e in parents),
        key=lambda d: d["likelihood"], reverse=True,
    )
    return envelope(
        result={"effect": effect, "factors": ranked},
        confidence=0.8,
        reasoning=f"{len(ranked)} candidate cause(s) for '{effect}'; leading: {ranked[0]['factor']}.",
        evidence=[f"{f['factor']} ({f['likelihood']})" for f in ranked[:4]],
        risk_level=RISK_LOW,
        recommended_next_action="explain-root-cause",
        safe_to_auto_execute=True,
    )


def _walk_to_root(symptom: str, signals: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], str, str]:
    """Follow the strongest upstream edge from a symptom back to a root cause."""
    chain: List[Dict[str, Any]] = []
    current = symptom
    seen = {current}
    intervention = ""
    for _ in range(12):  # bounded
        parents = _edges_into(current)
        if not parents:
            break
        best = max(parents, key=lambda e: e.strength * _signal_weight(signals, e.cause))
        chain.append(best.to_dict())
        intervention = best.intervention
        current = best.cause
        if current in seen:
            break
        seen.add(current)
    return chain, current, intervention


def explain_root_cause(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Trace a symptom upstream to its root cause + the breaking intervention."""
    symptom = str(require(payload, "symptom"))
    signals = opt(payload, "signals", {}) or {}
    chain, root, intervention = _walk_to_root(symptom, signals)
    if not chain:
        return envelope(
            result={"symptom": symptom, "root_cause": symptom, "chain": [], "intervention": ""},
            confidence=0.4,
            reasoning=f"'{symptom}' has no modelled upstream cause (treat as a root).",
            evidence=[f"symptom={symptom}"],
            risk_level=RISK_LOW,
            recommended_next_action="extend-causal-model",
            safe_to_auto_execute=True,
        )
    return envelope(
        result={
            "symptom": symptom,
            "root_cause": root,
            "chain": chain,
            "intervention": intervention,
            "depth": len(chain),
        },
        confidence=0.82,
        reasoning=f"Root cause of '{symptom}' is '{root}' (via {len(chain)} step(s)); fix: {intervention}.",
        evidence=[f"{c['cause']}->{c['effect']}" for c in chain],
        risk_level=RISK_MEDIUM,
        recommended_next_action="apply-intervention",
        safe_to_auto_execute=True,
    )


def detect_causal_chain(payload: Dict[str, Any]) -> Dict[str, Any]:
    """From a starting factor, follow the strongest downstream effects."""
    start = str(require(payload, "factor"))
    signals = opt(payload, "signals", {}) or {}
    chain: List[Dict[str, Any]] = []
    current = start
    seen = {current}
    for _ in range(12):
        children = _edges_from(current)
        if not children:
            break
        best = max(children, key=lambda e: e.strength * _signal_weight(signals, e.effect))
        chain.append(best.to_dict())
        current = best.effect
        if current in seen:
            break
        seen.add(current)
    terminal = current
    return envelope(
        result={"start": start, "chain": chain, "terminal_effect": terminal, "depth": len(chain)},
        confidence=0.8 if chain else 0.4,
        reasoning=(f"'{start}' propagates to '{terminal}' over {len(chain)} step(s)."
                   if chain else f"'{start}' has no modelled downstream effect."),
        evidence=[f"{c['cause']}->{c['effect']}" for c in chain] or [f"start={start}"],
        risk_level=RISK_MEDIUM if terminal in _SYMPTOMS else RISK_LOW,
        recommended_next_action="rank-causal-factors",
        safe_to_auto_execute=True,
    )


def rank_causal_factors(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Rank factors by causal leverage = downstream reach × strength × activity."""
    signals = opt(payload, "signals", {}) or {}
    factors = {e.cause for e in _MODEL} | {e.effect for e in _MODEL}

    def _reach(factor: str, depth: int, seen: set) -> float:
        # Full bounded downstream reach, discounted per hop, so a root that
        # drives a long chain to a symptom outscores a strong mid-chain edge.
        if depth > 10 or factor in seen:
            return 0.0
        seen = seen | {factor}
        total = 0.0
        for e in _edges_from(factor):
            total += (0.8 ** depth) * e.strength + _reach(e.effect, depth + 1, seen)
        return total

    scored = []
    for f in factors:
        out = _edges_from(f)
        if not out:
            continue
        leverage = round(_reach(f, 0, set()) * _signal_weight(signals, f), 3)
        scored.append({"factor": f, "leverage": leverage,
                       "fixes": sorted({e.intervention for e in out})})
    scored.sort(key=lambda d: d["leverage"], reverse=True)
    return envelope(
        result={"ranked": scored},
        confidence=0.8,
        reasoning=(f"Highest-leverage factor: {scored[0]['factor']} ({scored[0]['leverage']})."
                   if scored else "No causal factors to rank."),
        evidence=[f"{d['factor']}={d['leverage']}" for d in scored[:5]],
        risk_level=RISK_LOW,
        recommended_next_action="apply-intervention",
        safe_to_auto_execute=True,
    )


def update_causal_model(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Adjust an edge's strength from an observed outcome (TS persists the result).

    Payload: {cause, effect, confirmed: bool, [weight: 0..1]}. Confirmed
    observations nudge strength up, disconfirming ones down (bounded 0.05..0.99).
    """
    cause = str(require(payload, "cause"))
    effect = str(require(payload, "effect"))
    confirmed = bool(require(payload, "confirmed"))
    weight = float(opt(payload, "weight", 0.1))
    weight = max(0.0, min(0.5, weight))
    edge = next((e for e in _MODEL if e.cause == cause and e.effect == effect), None)
    prior = edge.strength if edge else 0.5
    delta = weight if confirmed else -weight
    updated = max(0.05, min(0.99, prior + delta))
    return envelope(
        result={
            "cause": cause,
            "effect": effect,
            "prior_strength": round(prior, 3),
            "observed": "confirmed" if confirmed else "disconfirmed",
            "updated_strength": round(updated, 3),
            "known_edge": edge is not None,
        },
        confidence=0.75,
        reasoning=f"{cause}->{effect}: {round(prior,3)} -> {round(updated,3)} ({'+' if confirmed else '-'}{weight}).",
        evidence=[f"prior={round(prior,3)}", f"confirmed={confirmed}"],
        risk_level=RISK_NONE,
        recommended_next_action="persist-causal-edge",
        safe_to_auto_execute=True,
    )


def explain_causal_model(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Plain-language explanation of the model, or of a single cause→effect edge."""
    cause = opt(payload, "cause", None)
    effect = opt(payload, "effect", None)
    if cause and effect:
        edge = next((e for e in _MODEL if e.cause == cause and e.effect == effect), None)
        if not edge:
            raise BrainError(f"no causal edge {cause!r} -> {effect!r}")
        return envelope(
            result={"edge": edge.to_dict(),
                    "explanation": f"{cause} causes {effect}: {edge.mechanism} Intervention: {edge.intervention}."},
            confidence=0.9,
            reasoning=edge.mechanism,
            evidence=[f"strength={round(edge.strength,3)}"],
            risk_level=RISK_NONE,
            recommended_next_action="apply-intervention",
            safe_to_auto_execute=True,
        )
    roots = sorted({e.cause for e in _MODEL} - {e.effect for e in _MODEL})
    symptoms = sorted({e.effect for e in _MODEL} - {e.cause for e in _MODEL})
    return envelope(
        result={
            "factor_count": len({e.cause for e in _MODEL} | {e.effect for e in _MODEL}),
            "edge_count": len(_MODEL),
            "root_factors": roots,
            "terminal_symptoms": symptoms,
            "explanation": "The causal model links pipeline factors to the symptoms they produce; "
                           "each edge carries the mechanism and the intervention that breaks it.",
        },
        confidence=0.9,
        reasoning=f"{len(_MODEL)} causal edges; {len(roots)} root factor(s), {len(symptoms)} terminal symptom(s).",
        evidence=[f"roots={','.join(roots[:4])}"],
        risk_level=RISK_NONE,
        recommended_next_action="build-causal-graph",
        safe_to_auto_execute=True,
    )
