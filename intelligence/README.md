# Via Fidei Intelligence Brain (Python)

The permanent intelligence core for the Admin Worker. **TypeScript is the
body** (execution, Prisma/DB writes, queues, policy, publishing, safety,
app + admin integration). **Python is the brain** (semantic memory,
duplicate detection, source intelligence, quality scoring, relationship
inference, repair analysis, self-inspection, planning). **Postgres is the
long-term store** — Python never touches it; TypeScript passes rows in and
persists whatever the brain returns.

## Design rules

- **Pure stdlib, no network, no AI APIs.** Runs anywhere `python3` exists;
  every result is deterministic and auditable (same input → same output),
  consistent with the existing `src/lib/admin-worker/brain.ts` rule.
- **Deterministic hash embeddings.** Offline sparse bag-of-words vectors
  (no model, no key). A real embedding model can be slotted behind the same
  interface later without changing callers.
- **One structured contract for every op** (see `contracts.py`): `result`,
  `confidence`, `reasoning`, `evidence`, `sources_used`, `risk_level`,
  `recommended_next_action`, `safe_to_auto_execute`. TypeScript validates it
  (Zod) before acting.
- **Recommend, don't execute.** The brain scores and explains; TypeScript's
  policy engine makes the final call. `safe_to_auto_execute` defaults
  conservatively and is always `false` for communion/doctrine calls.

## Invocation

```bash
python3 -m intelligence            # persistent loop: one JSON request/response per line
python3 -m intelligence --once     # single request on stdin -> one response
python3 -m intelligence --selftest # run every op against a sample payload
python3 -m intelligence --list-ops # list ops + protocol version
python3 -m intelligence.brain      # the standalone reasoning-loop demo
```

Request: `{"id": "abc", "op": "score_quality", "payload": { ... }}`
Response: the envelope plus `id`, `op`, `protocol_version`, `elapsed_ms`.

## Operations

| Op                                                          | Purpose                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `embed`, `semantic_search`                                  | semantic memory / vector search                                                 |
| `detect_duplicates`                                         | multi-signal duplicate detection                                                |
| `score_quality`                                             | per-record quality profile + publish gates                                      |
| `assess_source`, `detect_communion_risk`, `compare_sources` | source intelligence, Catholic communion-risk screening, contradiction detection |
| `infer_relationships`                                       | recommend edges between records                                                 |
| `classify_failure`, `diagnose_fetch`                        | repair intelligence + webpage-fetch diagnosis                                   |
| `self_inspect`, `developer_requests`, `iq_metrics`          | self-inspection, developer requests, worker-IQ metrics                          |
| `plan`, `prioritize`                                        | planning + priority intelligence                                                |
| `analyze_graph`                                             | knowledge-graph analysis                                                        |
| `scan_content`                                              | prompt-injection / manipulation detection                                       |
| `classify_freshness`                                        | refresh-cadence classification                                                  |

> **Communion-risk note:** `detect_communion_risk` emits a _verification
> flag_, never a canonical/doctrinal ruling. When uncertain it raises risk
> and recommends human review — the safe direction.

## Tests

```bash
python3 -m unittest discover -s intelligence/tests -t .
```
