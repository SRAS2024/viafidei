"""
Via Fidei intelligence brain (Python).

A permanent, pure-stdlib, deterministic intelligence core for the Admin
Worker. TypeScript remains the body — the safe execution layer, database
writer, Prisma layer, queue manager, policy enforcer, publisher and app
connection. This Python package is the brain: embeddings, semantic
memory, duplicate detection, source intelligence (including Catholic
communion-risk detection), quality scoring, relationship inference,
repair analysis, self-inspection and planning.

Design rules (consistent with src/lib/admin-worker/brain.ts):

  * No external AI APIs. No network. Pure stdlib only, so the brain runs
    anywhere ``python3`` exists and every result is deterministic and
    auditable.
  * Python never touches Postgres. TypeScript owns the database; it passes
    the relevant rows in and persists whatever the brain returns.
  * Every operation returns the same structured envelope (see
    ``intelligence.contracts``): result, confidence, reasoning, evidence,
    sources_used, risk_level, recommended_next_action and
    safe_to_auto_execute. TypeScript validates the envelope (Zod) before
    acting on it.

The brain is invoked as a subprocess: ``python3 -m intelligence`` speaks
newline-delimited JSON over stdio (see ``intelligence.main``).
"""

from __future__ import annotations

__version__ = "1.0.0"

# Bump when the request/response contract changes in a backwards-
# incompatible way. The TypeScript bridge checks this against its own
# expected value and refuses to use a mismatched brain.
PROTOCOL_VERSION = 1
