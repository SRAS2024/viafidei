"""
Operation registry — maps public op names to their handlers.

The TypeScript bridge calls ops by these names. Adding a new capability is
intentionally a one-line change here plus a new function in
``intelligence.operations`` — the "future-proof extensibility" the spec
asks for.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

from .operations import (
    awareness,
    duplicates,
    embeddings,
    extraction,
    freshness,
    gaps,
    graph,
    inspection,
    learning,
    planning,
    relationships,
    repair,
    security,
    self_model,
    sources,
    quality,
)

Handler = Callable[[Dict[str, Any]], Dict[str, Any]]

REGISTRY: Dict[str, Handler] = {
    # semantic memory / vectors
    "embed": embeddings.embed,
    "semantic_search": embeddings.semantic_search,
    # duplicates
    "detect_duplicates": duplicates.detect_duplicates,
    # quality
    "score_quality": quality.score_quality,
    # source intelligence + doctrine/communion
    "assess_source": sources.assess_source,
    "detect_communion_risk": sources.detect_communion_risk,
    "compare_sources": sources.compare_sources,
    # relationships
    "infer_relationships": relationships.infer_relationships,
    # repair + fetch diagnosis
    "classify_failure": repair.classify_failure,
    "diagnose_fetch": repair.diagnose_fetch,
    # self-inspection + developer requests + IQ
    "self_inspect": inspection.self_inspect,
    "developer_requests": inspection.developer_requests,
    "iq_metrics": inspection.iq_metrics,
    # planning + priority + final action selection
    "plan": planning.plan,
    "prioritize": planning.prioritize,
    "select_action": planning.select_action,
    # knowledge graph
    "analyze_graph": graph.analyze_graph,
    # security
    "scan_content": security.scan_content,
    # freshness
    "classify_freshness": freshness.classify_freshness,
    # knowledge extraction + structure + variants
    "extract_knowledge": extraction.extract_knowledge,
    "suggest_structure": extraction.suggest_structure,
    "detect_variants": extraction.detect_variants,
    # missing-information detection
    "detect_missing": gaps.detect_missing,
    # learning from outcomes (incl. admin feedback)
    "learn_from_outcome": learning.learn_from_outcome,
    # schema / UI awareness (code awareness is the unified self-model below)
    "analyze_schema": awareness.analyze_schema,
    "analyze_ui": awareness.analyze_ui,
    # unified self-model + deep code awareness (replaces summary-only analyze_code)
    "build_self_model": self_model.build_self_model,
    "build_symbol_graph": self_model.build_symbol_graph,
    "build_route_graph": self_model.build_route_graph,
    "build_schema_graph": self_model.build_schema_graph,
    "build_test_coverage_graph": self_model.build_test_coverage_graph,
    "explain_own_architecture": self_model.explain_own_architecture,
    "find_weak_modules": self_model.find_weak_modules,
    "find_untested_modules": self_model.find_untested_modules,
    "find_orphaned_code": self_model.find_orphaned_code,
    "find_duplicate_logic": self_model.find_duplicate_logic,
    "rank_self_upgrades": self_model.rank_self_upgrades,
    "detect_stuckness": self_model.detect_stuckness,
}


def list_ops() -> List[str]:
    return sorted(REGISTRY)
