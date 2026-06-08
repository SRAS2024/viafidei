"""
Self-model & deep code-awareness operations.

This module replaces the old summary-only ``analyze_code`` (line counts only)
with a real self-model: the brain reasons over an ingested corpus of the
codebase — files with their exports/imports, routes, Prisma models, package
scripts, worker stages, brain ops, and test→module links — that TypeScript
collects from the filesystem (TS owns filesystem access) and passes in.

Every op returns the standard strict envelope. Pure, deterministic, stdlib.
The brain *reasons*; it never edits code (review-gated by design).
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import jaccard, token_set


# ── corpus helpers ───────────────────────────────────────────────────
def _files(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    files = opt(payload, "files", [])
    return [f for f in files if isinstance(f, dict)] if isinstance(files, list) else []


def _file_lines(f: Dict[str, Any]) -> int:
    try:
        return int(f.get("lines") or 0)
    except (TypeError, ValueError):
        return 0


def _str_list(f: Dict[str, Any], key: str) -> List[str]:
    v = f.get(key)
    return [str(x) for x in v] if isinstance(v, list) else []


def _basename(path: str) -> str:
    """Module basename without extension, e.g. 'a/b/logs.ts' → 'logs'."""
    seg = path.replace("\\", "/").rsplit("/", 1)[-1]
    return seg.rsplit(".", 1)[0] if "." in seg else seg


def _import_index(files: List[Dict[str, Any]]) -> Dict[str, int]:
    """How many files import each module path. O(files·imports) via a
    basename→paths index (an import specifier's last path segment names the
    module), so it stays fast at ~1000 files."""
    by_base: Dict[str, List[str]] = {}
    for f in files:
        p = str(f.get("path") or "")
        if p:
            by_base.setdefault(_basename(p), []).append(p)
    counts: Dict[str, int] = {}
    for f in files:
        for imp in _str_list(f, "imports"):
            base = _basename(imp)
            for p in by_base.get(base, ()):
                counts[p] = counts.get(p, 0) + 1
    return counts


# ── ops ──────────────────────────────────────────────────────────────
def build_self_model(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Assemble the whole-application self-model from the ingested corpus."""
    files = _files(payload)
    routes = opt(payload, "routes", []) or []
    models = opt(payload, "models", []) or []
    scripts = opt(payload, "scripts", []) or []
    stages = opt(payload, "stages", []) or []
    brain_ops = opt(payload, "brain_ops", []) or []
    tests = [f for f in files if f.get("isTest")]
    src = [f for f in files if not f.get("isTest")]
    total_lines = sum(_file_lines(f) for f in files)
    covered = sum(1 for f in src if f.get("referencedByTests"))
    coverage = round(covered / max(len(src), 1), 3)

    model = {
        "file_count": len(files),
        "source_file_count": len(src),
        "test_file_count": len(tests),
        "total_lines": total_lines,
        "route_count": len(routes),
        "prisma_model_count": len(models),
        "script_count": len(scripts),
        "worker_stage_count": len(stages),
        "brain_op_count": len(brain_ops),
        "test_coverage_ratio": coverage,
        "largest_modules": [
            {"path": f.get("path"), "lines": _file_lines(f)}
            for f in sorted(src, key=_file_lines, reverse=True)[:10]
        ],
    }
    return envelope(
        result=model,
        confidence=0.85 if files else 0.2,
        reasoning=(
            f"Self-model: {len(files)} files ({len(src)} source, {len(tests)} test), "
            f"{len(routes)} routes, {len(models)} Prisma models, {len(brain_ops)} brain ops, "
            f"{len(stages)} worker stages; module test coverage {int(coverage * 100)}%."
        ),
        evidence=[
            f"{total_lines} total lines",
            f"{covered}/{len(src)} source modules referenced by a test",
        ],
        risk_level=RISK_NONE,
        recommended_next_action="rank-self-upgrades",
    )


def build_symbol_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Nodes = modules, edges = imports; surface most-depended + orphans."""
    files = _files(payload)
    paths = [str(f.get("path") or "") for f in files]
    imported_by = _import_index(files)
    edges = sum(len(_str_list(f, "imports")) for f in files)
    most_depended = sorted(imported_by.items(), key=lambda kv: kv[1], reverse=True)[:10]
    orphans = [
        p
        for p in paths
        if p and imported_by.get(p, 0) == 0 and not _is_entrypoint(p)
    ]
    return envelope(
        result={
            "node_count": len(paths),
            "edge_count": edges,
            "most_depended_on": [{"path": p, "importers": n} for p, n in most_depended],
            "orphan_candidates": orphans[:25],
        },
        confidence=0.8 if files else 0.2,
        reasoning=f"Symbol graph: {len(paths)} modules, {edges} import edges, {len(orphans)} orphan candidate(s).",
        evidence=[f"{p} ← {n} importers" for p, n in most_depended[:5]],
        risk_level=RISK_NONE,
        recommended_next_action="find-orphaned-code",
    )


def build_route_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Route → owning file ownership map; flag routes with no owner file."""
    routes = [r for r in (opt(payload, "routes", []) or []) if isinstance(r, dict)]
    owned = [r for r in routes if r.get("file")]
    orphan_routes = [r.get("path") for r in routes if not r.get("file")]
    return envelope(
        result={
            "route_count": len(routes),
            "owned_routes": len(owned),
            "orphan_routes": orphan_routes,
            "routes": [{"path": r.get("path"), "file": r.get("file")} for r in routes[:60]],
        },
        confidence=0.8 if routes else 0.3,
        reasoning=f"Route graph: {len(owned)}/{len(routes)} routes have an owning page/handler file.",
        evidence=[str(r.get("path")) for r in routes[:8]],
        risk_level=RISK_NONE,
        recommended_next_action="route-graph-ready",
    )


def build_schema_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Prisma model → consumer count; surface unused models."""
    models = [m for m in (opt(payload, "models", []) or []) if isinstance(m, dict)]
    unused = [m.get("name") for m in models if int(m.get("usedByFiles") or 0) == 0]
    hot = sorted(models, key=lambda m: int(m.get("usedByFiles") or 0), reverse=True)[:10]
    return envelope(
        result={
            "model_count": len(models),
            "unused_models": unused,
            "most_used_models": [
                {"name": m.get("name"), "consumers": int(m.get("usedByFiles") or 0)} for m in hot
            ],
        },
        confidence=0.8 if models else 0.3,
        reasoning=f"Schema graph: {len(models)} models, {len(unused)} with no detected consumer.",
        evidence=[f"{m.get('name')} ← {int(m.get('usedByFiles') or 0)}" for m in hot[:5]],
        risk_level=RISK_LOW if unused else RISK_NONE,
        recommended_next_action="review-unused-models" if unused else "schema-graph-ready",
    )


def build_test_coverage_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Map source modules to whether a test references them; coverage %."""
    files = _files(payload)
    src = [f for f in files if not f.get("isTest")]
    covered = [f for f in src if f.get("referencedByTests")]
    uncovered = [str(f.get("path")) for f in src if not f.get("referencedByTests")]
    ratio = round(len(covered) / max(len(src), 1), 3)
    return envelope(
        result={
            "source_modules": len(src),
            "covered_modules": len(covered),
            "uncovered_modules": uncovered[:40],
            "coverage_ratio": ratio,
        },
        confidence=0.8 if src else 0.2,
        reasoning=f"Test-coverage graph: {len(covered)}/{len(src)} source modules referenced by a test ({int(ratio * 100)}%).",
        evidence=[f"{len(uncovered)} modules have no referencing test"],
        risk_level=RISK_MEDIUM if ratio < 0.5 else RISK_LOW if ratio < 0.8 else RISK_NONE,
        recommended_next_action="find-untested-modules" if uncovered else "coverage-healthy",
    )


def explain_own_architecture(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Narrate the unified architecture with evidence from the self-model."""
    m = opt(payload, "model", {}) or {}
    files = int(m.get("file_count") or 0)
    routes = int(m.get("route_count") or 0)
    models = int(m.get("prisma_model_count") or 0)
    ops = int(m.get("brain_op_count") or 0)
    stages = int(m.get("worker_stage_count") or 0)
    narrative = [
        "Python intelligence brain = the unified reasoning core: planning, final "
        f"action selection, self-modeling, memory retrieval, learning, and upgrade "
        f"requests ({ops} brain operations).",
        "TypeScript = the safe execution + enforcement body: filesystem, network, "
        f"Prisma writes, publishing, verification, rollback, policy ({routes} public/admin "
        "routes, the Admin Worker dispatcher with "
        f"{stages} mission stages).",
        f"Postgres = durable memory + audit store ({models} Prisma models): brain-call "
        "audit trail, knowledge graph, self-model snapshots, developer/upgrade requests, "
        "and outcome history.",
    ]
    return envelope(
        result={"layers": narrative, "evidence_counts": m},
        confidence=0.82 if m else 0.3,
        reasoning="Explained the Python-brain / TypeScript-body / Postgres-memory unified architecture from the live self-model.",
        evidence=[f"{files} files", f"{routes} routes", f"{models} models", f"{ops} brain ops"],
        risk_level=RISK_NONE,
        recommended_next_action="architecture-explained",
    )


def _split_plan(f: Dict[str, Any]) -> str:
    exports = _str_list(f, "exports")
    if len(exports) >= 6:
        return (
            f"Has {len(exports)} exports — split by concern into focused modules "
            f"(e.g. group: {', '.join(exports[:4])} …)."
        )
    return "Extract the largest functions/sections into separate modules with their own tests."


def find_weak_modules(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Oversized / highly-coupled / untested modules with WHY + split plan + risk."""
    files = _files(payload)
    src = [f for f in files if not f.get("isTest")]
    oversized_threshold = int(opt(payload, "oversized_threshold", 800))
    imported_by = _import_index(files)
    weak: List[Dict[str, Any]] = []
    for f in src:
        path = str(f.get("path") or "")
        lines = _file_lines(f)
        importers = imported_by.get(path, 0)
        imports = len(_str_list(f, "imports"))
        reasons = []
        if lines > oversized_threshold:
            reasons.append(f"oversized ({lines} lines)")
        if importers >= 12:
            reasons.append(f"highly depended-on ({importers} importers) — changes are high-blast-radius")
        if imports >= 25:
            reasons.append(f"highly coupled ({imports} imports)")
        if not f.get("referencedByTests"):
            reasons.append("no referencing test")
        if not reasons:
            continue
        risk = RISK_MEDIUM if (lines > oversized_threshold or importers >= 12) else RISK_LOW
        weak.append(
            {
                "path": path,
                "lines": lines,
                "importers": importers,
                "why": "; ".join(reasons),
                "suggested_split": _split_plan(f),
                "refactor_risk": risk,
                "suggested_tests": f"Add unit tests covering {path} before refactor.",
            }
        )
    weak.sort(key=lambda w: (w["lines"], w["importers"]), reverse=True)
    return envelope(
        result={"weak_modules": weak[:25], "weak_count": len(weak)},
        confidence=0.8 if src else 0.2,
        reasoning=f"Found {len(weak)} weak module(s) (oversized / highly-coupled / untested) with split plans.",
        evidence=[f"{w['path']}: {w['why']}" for w in weak[:6]] or ["no weak modules"],
        risk_level=RISK_LOW if weak else RISK_NONE,
        recommended_next_action="rank-self-upgrades" if weak else "modules-healthy",
        safe_to_auto_execute=False,
    )


def find_untested_modules(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Source modules with no referencing test."""
    files = _files(payload)
    src = [f for f in files if not f.get("isTest")]
    untested = [
        {"path": str(f.get("path")), "lines": _file_lines(f)}
        for f in src
        if not f.get("referencedByTests")
    ]
    untested.sort(key=lambda x: x["lines"], reverse=True)
    return envelope(
        result={"untested_modules": untested[:40], "untested_count": len(untested)},
        confidence=0.8 if src else 0.2,
        reasoning=f"{len(untested)}/{len(src)} source modules have no referencing test.",
        evidence=[u["path"] for u in untested[:8]] or ["all modules referenced by a test"],
        risk_level=RISK_MEDIUM if len(untested) > len(src) / 2 else RISK_LOW,
        recommended_next_action="suggest-regression-tests" if untested else "coverage-healthy",
        safe_to_auto_execute=False,
    )


def _is_entrypoint(path: str) -> bool:
    p = path.lower()
    return (
        "page.tsx" in p
        or "route.ts" in p
        or "layout.tsx" in p
        or "/scripts/" in p
        or p.endswith("index.ts")
        or "middleware" in p
        or "/__main__" in p
    )


def find_orphaned_code(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Exported modules never imported anywhere and not an entrypoint."""
    files = _files(payload)
    src = [f for f in files if not f.get("isTest")]
    imported_by = _import_index(files)
    orphans = [
        {"path": str(f.get("path")), "exports": _str_list(f, "exports")}
        for f in src
        if str(f.get("path"))
        and imported_by.get(str(f.get("path")), 0) == 0
        and not _is_entrypoint(str(f.get("path")))
        and _str_list(f, "exports")
    ]
    return envelope(
        result={"orphan_candidates": orphans[:30], "orphan_count": len(orphans)},
        confidence=0.6 if src else 0.2,
        reasoning=f"{len(orphans)} module(s) export symbols but appear to have no importer (review for dead code).",
        evidence=[o["path"] for o in orphans[:8]] or ["no orphan candidates"],
        risk_level=RISK_LOW,
        recommended_next_action="review-orphan-candidates" if orphans else "no-orphans",
        safe_to_auto_execute=False,
    )


def find_duplicate_logic(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Near-duplicate modules by export-symbol/token overlap (Jaccard)."""
    files = _files(payload)
    src = [f for f in files if not f.get("isTest")]
    threshold = float(opt(payload, "threshold", 0.6))
    sigs: List[Tuple[str, set]] = []
    for f in src:
        path = str(f.get("path") or "")
        # Signature = the module's exported symbol names (the real duplicate-logic
        # signal). Require ≥2 exports so trivial single-symbol modules don't match.
        sig = token_set(" ".join(_str_list(f, "exports")))
        if len(sig) >= 2:
            sigs.append((path, sig))
    # Bucket by the alphabetically-first export token so we only compare modules
    # that share a symbol — avoids the O(n²) all-pairs blowup at ~1000 modules.
    buckets: Dict[str, List[Tuple[str, set]]] = {}
    for path, sig in sigs:
        buckets.setdefault(min(sig), []).append((path, sig))
    pairs: List[Dict[str, Any]] = []
    for group in buckets.values():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                score = jaccard(group[i][1], group[j][1])
                if score >= threshold:
                    pairs.append({"a": group[i][0], "b": group[j][0], "overlap": round(score, 3)})
    pairs.sort(key=lambda p: p["overlap"], reverse=True)
    return envelope(
        result={"duplicate_pairs": pairs[:20], "pair_count": len(pairs)},
        confidence=0.55,
        reasoning=f"{len(pairs)} module pair(s) share a high symbol/name overlap — candidates for consolidation.",
        evidence=[f"{p['a']} ~ {p['b']} ({p['overlap']})" for p in pairs[:6]] or ["no duplicate logic surfaced"],
        risk_level=RISK_LOW,
        recommended_next_action="review-duplicate-logic" if pairs else "no-duplicates",
        safe_to_auto_execute=False,
    )


def rank_self_upgrades(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Synthesize weak/untested/orphan/duplicate findings into ranked upgrades."""
    weak = opt(payload, "weak_modules", []) or []
    untested = opt(payload, "untested_modules", []) or []
    orphans = opt(payload, "orphan_candidates", []) or []
    duplicates = opt(payload, "duplicate_pairs", []) or []
    coverage = float(opt(payload, "coverage_ratio", 1.0))

    upgrades: List[Dict[str, Any]] = []

    def add(title, category, problem, evidence, files, gain, difficulty, priority, confidence):
        upgrades.append(
            {
                "title": title,
                "category": category,
                "problem": problem,
                "evidence": evidence,
                "affected_files": files,
                "expected_intelligence_gain": gain,
                "implementation_difficulty": difficulty,
                "priority_score": round(priority, 3),
                "confidence_score": round(confidence, 3),
                "suggested_tests": "Add/extend tests covering the affected files before changing them.",
                "rollback_plan": "Revert the commit; no schema/data migration required.",
            }
        )

    for w in weak[:6]:
        sev = 0.8 if "oversized" in str(w.get("why", "")) else 0.6
        add(
            f"Refactor weak module {w.get('path')}",
            "code",
            str(w.get("why", "")),
            [str(w.get("why", ""))],
            [str(w.get("path"))],
            "lower change-risk + easier future reasoning",
            "medium",
            sev + 0.1 * min(int(w.get("importers") or 0), 5) / 5,
            0.7,
        )
    if untested:
        add(
            f"Add tests for {len(untested)} untested module(s)",
            "test",
            f"{len(untested)} source modules have no referencing test; coverage {int(coverage*100)}%.",
            [str(u.get('path')) for u in untested[:8]],
            [str(u.get("path")) for u in untested[:12]],
            "regression safety + safer self-upgrades",
            "medium",
            0.65 + (0.5 - min(coverage, 0.5)),
            0.75,
        )
    if duplicates:
        add(
            f"Consolidate {len(duplicates)} duplicate-logic pair(s)",
            "code",
            "Modules with high symbol/name overlap may duplicate logic.",
            [f"{p.get('a')} ~ {p.get('b')}" for p in duplicates[:6]],
            sorted({str(p.get("a")) for p in duplicates} | {str(p.get("b")) for p in duplicates})[:12],
            "single source of truth, less drift",
            "medium",
            0.5,
            0.55,
        )
    if orphans:
        add(
            f"Review {len(orphans)} orphan module(s) for dead code",
            "code",
            "Modules export symbols with no detected importer.",
            [str(o.get("path")) for o in orphans[:8]],
            [str(o.get("path")) for o in orphans[:12]],
            "smaller, clearer codebase",
            "low",
            0.4,
            0.5,
        )

    upgrades.sort(key=lambda u: u["priority_score"], reverse=True)
    return envelope(
        result={"upgrades": upgrades, "upgrade_count": len(upgrades)},
        confidence=0.8 if upgrades else 0.4,
        reasoning=f"Ranked {len(upgrades)} self-upgrade request(s) from the self-model findings.",
        evidence=[u["title"] for u in upgrades[:6]] or ["no upgrades needed"],
        risk_level=RISK_LOW,
        recommended_next_action="create-developer-requests" if upgrades else "self-healthy",
        safe_to_auto_execute=False,
    )


def detect_stuckness(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Detect spinning: stage loops, source loops, repair loops, no growth."""
    decisions = opt(payload, "recent_decisions", []) or []  # [{missionStage}]
    repairs = opt(payload, "recent_repairs", []) or []  # [{kind,status}]
    published_delta = int(opt(payload, "published_delta", 0))
    passes = int(opt(payload, "pass_count", 0))
    source_fatigue = opt(payload, "source_fatigue", {}) or {}  # {host: failures}

    signals: List[str] = []
    stage_counts: Dict[str, int] = {}
    for d in decisions:
        s = str(d.get("missionStage") or "")
        if s:
            stage_counts[s] = stage_counts.get(s, 0) + 1
    dominant = max(stage_counts.items(), key=lambda kv: kv[1], default=("", 0))
    if dominant[1] >= max(5, int(0.8 * len(decisions))) and len(decisions) >= 5:
        signals.append(f"stage loop: '{dominant[0]}' chosen {dominant[1]}/{len(decisions)} recent passes")

    failed_repairs: Dict[str, int] = {}
    for r in repairs:
        if str(r.get("status")) in ("FAILED", "ABANDONED"):
            k = str(r.get("kind") or "")
            failed_repairs[k] = failed_repairs.get(k, 0) + 1
    for kind, n in failed_repairs.items():
        if n >= 3:
            signals.append(f"repair loop: '{kind}' repair failed {n} times")

    bad_sources = [h for h, n in source_fatigue.items() if int(n) >= 3]
    for h in bad_sources[:5]:
        signals.append(f"source loop: '{h}' failing repeatedly ({source_fatigue[h]}x) — deprioritize")

    if passes >= 5 and published_delta == 0:
        signals.append(f"no content growth across {passes} passes despite activity")

    stuck = len(signals) > 0
    strategy = (
        "Switch strategy: deprioritize the failing source/stage, try a different content type "
        "or source, and file/act on an upgrade request for the blocker."
        if stuck
        else "Not stuck — continue the current mission."
    )
    return envelope(
        result={"stuck": stuck, "signals": signals, "recommended_unblock": strategy},
        confidence=0.78 if (decisions or repairs or passes) else 0.3,
        reasoning=(f"Stuckness check: {len(signals)} signal(s)." if stuck else "No stuckness signals."),
        evidence=signals or ["no loops / growth is occurring"],
        risk_level=RISK_MEDIUM if stuck else RISK_NONE,
        recommended_next_action="change-strategy" if stuck else "continue-mission",
    )
