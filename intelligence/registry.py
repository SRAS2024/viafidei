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
    authority,
    awareness,
    calibration,
    catholic_extraction,
    causal,
    claims,
    counterfactual,
    duplicates,
    embeddings,
    experiments,
    explanation,
    extraction,
    freshness,
    gaps,
    graph,
    hypotheses,
    inspection,
    learning,
    lectionary,
    memory_layers,
    mission,
    patches,
    planning,
    relationships,
    repair,
    replay,
    retrieval,
    security,
    self_model,
    simulation,
    sources,
    specialists,
    stuckness,
    testgaps,
    upgrades,
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
    # liturgical calendar + lectionary (the brain's knowledge of the Church year)
    "liturgical_day": lectionary.liturgical_day,
    "lectionary_readings": lectionary.lectionary_readings,
    # ── Intelligence Laboratory ──────────────────────────────────────────
    # Causal Intelligence Core (why things happen, not just what happened)
    "build_causal_graph": causal.build_causal_graph,
    "infer_causal_factors": causal.infer_causal_factors,
    "explain_root_cause": causal.explain_root_cause,
    "detect_causal_chain": causal.detect_causal_chain,
    "rank_causal_factors": causal.rank_causal_factors,
    "update_causal_model": causal.update_causal_model,
    "explain_causal_model": causal.explain_causal_model,
    # Counterfactual reasoning (what would another choice have done?)
    "run_counterfactual_analysis": counterfactual.run_counterfactual_analysis,
    "estimate_alternative_outcome": counterfactual.estimate_alternative_outcome,
    "explain_counterfactual_difference": counterfactual.explain_counterfactual_difference,
    "rank_counterfactual_paths": counterfactual.rank_counterfactual_paths,
    # Safe experiment design (bounded, auditable, reversible)
    "design_safe_experiment": experiments.design_safe_experiment,
    "run_experiment_plan": experiments.run_experiment_plan,
    "evaluate_experiment_result": experiments.evaluate_experiment_result,
    "compare_experiment_groups": experiments.compare_experiment_groups,
    "extract_experiment_lesson": experiments.extract_experiment_lesson,
    "recommend_experiment_followup": experiments.recommend_experiment_followup,
    # Hypothesis engine (form, rank, test, evaluate)
    "generate_hypothesis": hypotheses.generate_hypothesis,
    "rank_hypotheses": hypotheses.rank_hypotheses,
    "test_hypothesis": hypotheses.test_hypothesis,
    "evaluate_hypothesis_result": hypotheses.evaluate_hypothesis_result,
    "accept_or_reject_hypothesis": hypotheses.accept_or_reject_hypothesis,
    "store_hypothesis_lesson": hypotheses.store_hypothesis_lesson,
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
    "ingest_codebase": self_model.ingest_codebase,
    "build_self_model": self_model.build_self_model,
    "build_symbol_graph": self_model.build_symbol_graph,
    "build_call_graph": self_model.build_call_graph,
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
    # Catholic authority graph
    "build_catholic_authority_graph": authority.build_catholic_authority_graph,
    "rank_catholic_source_authority": authority.rank_catholic_source_authority,
    "resolve_authority_chain": authority.resolve_authority_chain,
    "classify_document_authority": authority.classify_document_authority,
    "classify_source_role": authority.classify_source_role,
    "explain_authority_decision": authority.explain_authority_decision,
    # claim-level verification
    "extract_claims": claims.extract_claims,
    "normalize_claim": claims.normalize_claim,
    "compare_claims": claims.compare_claims,
    "detect_date_conflict": claims.detect_date_conflict,
    "detect_entity_conflict": claims.detect_entity_conflict,
    "detect_title_conflict": claims.detect_title_conflict,
    "detect_liturgical_conflict": claims.detect_liturgical_conflict,
    "resolve_claim_with_authority": claims.resolve_claim_with_authority,
    "build_claim_evidence_pack": claims.build_claim_evidence_pack,
    # action simulation before execution
    "simulate_action": simulation.simulate_action,
    "predict_action_outcome": simulation.predict_action_outcome,
    "estimate_failure_modes": simulation.estimate_failure_modes,
    "estimate_repair_cost": simulation.estimate_repair_cost,
    "estimate_publish_risk": simulation.estimate_publish_risk,
    "compare_counterfactual_actions": simulation.compare_counterfactual_actions,
    # confidence calibration + outcome grading
    "calibrate_confidence": calibration.calibrate_confidence,
    "measure_prediction_accuracy": calibration.measure_prediction_accuracy,
    "grade_brain_decision": calibration.grade_brain_decision,
    "track_false_positive_risk": calibration.track_false_positive_risk,
    "track_false_negative_risk": calibration.track_false_negative_risk,
    "score_decision_quality": calibration.score_decision_quality,
    # stuckness detection (granular loops; detect_stuckness is the umbrella above)
    "detect_action_loop": stuckness.detect_action_loop,
    "detect_source_loop": stuckness.detect_source_loop,
    "detect_repair_loop": stuckness.detect_repair_loop,
    "detect_no_growth": stuckness.detect_no_growth,
    "explain_no_growth": stuckness.explain_no_growth,
    "recommend_unblock_strategy": stuckness.recommend_unblock_strategy,
    # mission control
    "build_mission_tree": mission.build_mission_tree,
    "update_mission_progress": mission.update_mission_progress,
    "detect_mission_blockers": mission.detect_mission_blockers,
    "rank_subgoals": mission.rank_subgoals,
    "recommend_next_mission_action": mission.recommend_next_mission_action,
    # richer self-explanation
    "explain_decision": explanation.explain_decision,
    "explain_rejected_alternatives": explanation.explain_rejected_alternatives,
    "explain_safety_gate": explanation.explain_safety_gate,
    "explain_confidence": explanation.explain_confidence,
    "explain_what_would_change_my_mind": explanation.explain_what_would_change_my_mind,
    # upgrade-request engine (internal product manager)
    "rank_upgrade_requests": upgrades.rank_upgrade_requests,
    "explain_upgrade_request": upgrades.explain_upgrade_request,
    "merge_duplicate_upgrade_requests": upgrades.merge_duplicate_upgrade_requests,
    "detect_ignored_upgrade_requests": upgrades.detect_ignored_upgrade_requests,
    "estimate_upgrade_roi": upgrades.estimate_upgrade_roi,
    # test-gap detection → regression-test recommendations
    "detect_test_gap": testgaps.detect_test_gap,
    "suggest_regression_test": testgaps.suggest_regression_test,
    "generate_test_fixture_plan": testgaps.generate_test_fixture_plan,
    "propose_test_patch": testgaps.propose_test_patch,
    "rank_missing_tests": testgaps.rank_missing_tests,
    # internal specialist reviewers
    "specialist_reviews": specialists.specialist_reviews,
    "combine_specialist_reviews": specialists.combine_specialist_reviews,
    # multi-layer memory
    "consolidate_memories": memory_layers.consolidate_memories,
    "summarize_repeated_lessons": memory_layers.summarize_repeated_lessons,
    "merge_duplicate_memories": memory_layers.merge_duplicate_memories,
    "detect_conflicting_memories": memory_layers.detect_conflicting_memories,
    "retire_stale_memories": memory_layers.retire_stale_memories,
    "rank_memory_importance": memory_layers.rank_memory_importance,
    "retrieve_context_pack": memory_layers.retrieve_context_pack,
    "extract_upgrade_requests_from_memory": memory_layers.extract_upgrade_requests_from_memory,
    # hybrid retrieval
    "hybrid_search": retrieval.hybrid_search,
    "rank_memory_candidates": retrieval.rank_memory_candidates,
    "rank_source_candidates": retrieval.rank_source_candidates,
    "rank_related_content": retrieval.rank_related_content,
    "explain_retrieval_result": retrieval.explain_retrieval_result,
    "detect_memory_gap": retrieval.detect_memory_gap,
    # Catholic content extraction intelligence
    "identify_document_type": catholic_extraction.identify_document_type,
    "extract_structured_catholic_document": catholic_extraction.extract_structured_catholic_document,
    "extract_liturgical_date": catholic_extraction.extract_liturgical_date,
    "extract_canon_law_reference": catholic_extraction.extract_canon_law_reference,
    "extract_catechism_reference": catholic_extraction.extract_catechism_reference,
    "extract_papal_document_metadata": catholic_extraction.extract_papal_document_metadata,
    "extract_council_document_metadata": catholic_extraction.extract_council_document_metadata,
    "extract_saint_metadata": catholic_extraction.extract_saint_metadata,
    "extract_parish_metadata": catholic_extraction.extract_parish_metadata,
    "extract_prayer_metadata": catholic_extraction.extract_prayer_metadata,
    "extract_novena_metadata": catholic_extraction.extract_novena_metadata,
    "extract_litany_metadata": catholic_extraction.extract_litany_metadata,
    "build_church_history_timeline_entry": catholic_extraction.build_church_history_timeline_entry,
    # review-gated self-improvement (propose only; never auto-deploy)
    "propose_code_patch": patches.propose_code_patch,
    "propose_schema_migration": patches.propose_schema_migration,
    "review_patch_risk": patches.review_patch_risk,
    "generate_rollback_plan": patches.generate_rollback_plan,
    "explain_patch_value": patches.explain_patch_value,
    # replayability & resilience (event-sourced decision/brain-call reasoning)
    "replay_decision": replay.replay_decision,
    "compare_decisions": replay.compare_decisions,
    "explain_decision_change": replay.explain_decision_change,
    "detect_decision_drift": replay.detect_decision_drift,
    "recommend_circuit_break": replay.recommend_circuit_break,
    "check_replay_integrity": replay.check_replay_integrity,
}


def list_ops() -> List[str]:
    return sorted(REGISTRY)
