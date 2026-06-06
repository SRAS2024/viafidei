"""
Knowledge-graph intelligence.

TypeScript persists the graph (nodes + edges) in Postgres; this operation
analyses a supplied subgraph to find orphaned records, weakly connected
nodes, hubs, connected components, duplicate clusters and *missing* edges
the worker should consider creating.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Tuple

from ..contracts import RISK_LOW, RISK_NONE, envelope, opt, require
from ..core import normalize_text, str_ratio


class _DSU:
    def __init__(self) -> None:
        self.parent: Dict[Any, Any] = {}

    def find(self, x: Any) -> Any:
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: Any, b: Any) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def analyze_graph(payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = require(payload, "nodes")
    edges = require(payload, "edges")
    nodes = nodes if isinstance(nodes, list) else []
    edges = edges if isinstance(edges, list) else []

    node_ids = [n.get("id") for n in nodes if n.get("id") is not None]
    labels = {n.get("id"): str(n.get("label") or n.get("title") or "") for n in nodes}
    types = {n.get("id"): str(n.get("type") or "") for n in nodes}

    degree: Dict[Any, int] = defaultdict(int)
    neighbors: Dict[Any, set] = defaultdict(set)
    dsu = _DSU()
    for nid in node_ids:
        dsu.find(nid)
    for e in edges:
        a, b = e.get("source"), e.get("target")
        if a is None or b is None:
            continue
        degree[a] += 1
        degree[b] += 1
        neighbors[a].add(b)
        neighbors[b].add(a)
        dsu.union(a, b)

    orphans = [nid for nid in node_ids if degree.get(nid, 0) == 0]
    weakly_connected = [nid for nid in node_ids if degree.get(nid, 0) == 1]
    hubs = sorted(
        [{"id": nid, "degree": degree.get(nid, 0)} for nid in node_ids],
        key=lambda x: x["degree"],
        reverse=True,
    )[:5]

    components = len({dsu.find(nid) for nid in node_ids}) if node_ids else 0

    # Missing edges: pairs sharing >= 2 neighbours but not directly linked,
    # or near-identical labels of the same type (a connection that "should"
    # exist).
    missing: List[Dict[str, Any]] = []
    seen_pairs: set = set()
    id_list = node_ids
    for i in range(len(id_list)):
        for j in range(i + 1, len(id_list)):
            a, b = id_list[i], id_list[j]
            if b in neighbors[a]:
                continue
            shared = neighbors[a] & neighbors[b]
            union = (neighbors[a] | neighbors[b]) - {a, b}
            # Neighbour-Jaccard, not raw count: two nodes whose *only* link is
            # the same hub overlap fully and are a strong "should connect"
            # signal, while two busy nodes sharing one hub are not.
            nj = (len(shared) / len(union)) if union else 0.0
            la, lb = normalize_text(labels.get(a, "")), normalize_text(labels.get(b, ""))
            label_sim = str_ratio(la, lb) if la and lb else 0.0
            reason = None
            if shared and (nj >= 0.5 or len(shared) >= 3):
                reason = f"share {len(shared)} neighbour(s) (overlap {nj:.2f})"
            elif label_sim >= 0.8 and types.get(a) == types.get(b):
                reason = f"near-identical labels (sim {label_sim:.2f}) of the same type"
            if reason and (a, b) not in seen_pairs:
                seen_pairs.add((a, b))
                conf = round(min(0.4 + 0.4 * nj + 0.3 * label_sim, 0.95), 3)
                missing.append({"source": a, "target": b, "reason": reason, "confidence": conf})

    missing.sort(key=lambda m: m["confidence"], reverse=True)
    missing = missing[: int(opt(payload, "max_suggestions", 20))]

    # Duplicate clusters: connected groups of near-identical labels.
    dup_dsu = _DSU()
    for nid in node_ids:
        dup_dsu.find(nid)
    for i in range(len(id_list)):
        for j in range(i + 1, len(id_list)):
            a, b = id_list[i], id_list[j]
            la, lb = normalize_text(labels.get(a, "")), normalize_text(labels.get(b, ""))
            if la and lb and str_ratio(la, lb) >= 0.9:
                dup_dsu.union(a, b)
    clusters: Dict[Any, List[Any]] = defaultdict(list)
    for nid in node_ids:
        clusters[dup_dsu.find(nid)].append(nid)
    duplicate_clusters = [grp for grp in clusters.values() if len(grp) > 1]

    findings = {
        "node_count": len(node_ids),
        "edge_count": len(edges),
        "components": components,
        "orphans": orphans,
        "weakly_connected": weakly_connected,
        "hubs": hubs,
        "missing_edges": missing,
        "duplicate_clusters": duplicate_clusters,
    }
    issues = len(orphans) + len(missing) + len(duplicate_clusters)
    return envelope(
        result=findings,
        confidence=0.7 if node_ids else 0.2,
        reasoning=(
            f"Graph: {len(node_ids)} nodes / {len(edges)} edges in {components} component(s); "
            f"{len(orphans)} orphan(s), {len(missing)} suggested edge(s), "
            f"{len(duplicate_clusters)} duplicate cluster(s)."
        ),
        evidence=[m["reason"] for m in missing[:3]] or ["no structural gaps found"],
        risk_level=RISK_LOW if issues else RISK_NONE,
        recommended_next_action="create-relationship-and-dedupe-tasks" if issues else "graph-healthy",
        safe_to_auto_execute=False,
    )
