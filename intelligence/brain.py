"""
intelligence.brain — the bounded-rationality reasoning loop (ported).

This is the Brain from the operator-provided script, kept intact so it
runs standalone (``python3 -m intelligence.brain`` reproduces the
original demo). The integrated ``plan`` operation in
``intelligence.operations.planning`` reuses ``decompose`` and the
action-scoring helpers here, but recommends rather than executes — the
real tools live in TypeScript, which stays the conductor.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, Awaitable, Dict, List, Optional, Protocol

from .core import Action, Budget, Memory, Thought, clamp, stable_hash
from .memory_store import MemoryStore


class ToolFn(Protocol):
    def __call__(self, args: Dict[str, Any]) -> Awaitable[Dict[str, Any]]: ...


@dataclass(slots=True)
class Tool:
    name: str
    fn: ToolFn
    cost: float = 0.1
    risk: float = 0.05
    description: str = ""


def decompose_objective(objective: str, memories: List[Memory]) -> List[Thought]:
    """Standing reasoning principles, weighted by how much context we have.

    Pure function (no Brain instance needed) so the planning operation can
    reuse it without spinning up a MemoryStore.
    """
    context = " ".join(m.text for m in memories[:5])
    uncertainty = 0.25 if memories else 0.55
    return [
        Thought(
            claim=f"Clarify success condition for: {objective}",
            confidence=0.88,
            risk=0.08,
            value=0.92,
            evidence=[context],
        ),
        Thought(
            claim="Retrieve only the minimum relevant memory and evidence.",
            confidence=0.84,
            risk=uncertainty,
            value=0.86,
            evidence=[context],
        ),
        Thought(
            claim="Prefer reversible, cheap, high-information actions first.",
            confidence=0.91,
            risk=0.05,
            value=0.95,
            evidence=["bounded rationality"],
        ),
        Thought(
            claim="Stop when confidence is sufficient or cost exceeds expected value.",
            confidence=0.89,
            risk=0.06,
            value=0.93,
            evidence=["resource control"],
        ),
    ]


class Brain:
    def __init__(self, memory_path: str = ":memory:") -> None:
        self.memory = MemoryStore(memory_path)
        self.tools: Dict[str, Tool] = {}
        self.policy_stats: Dict[str, tuple] = {}

    def register_tool(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def decompose(self, objective: str, memories: List[Memory]) -> List[Thought]:
        return decompose_objective(objective, memories)

    def choose_actions(
        self, objective: str, thoughts: List[Thought], budget: Budget
    ) -> List[Action]:
        actions: List[Action] = []
        if "search" in self.tools:
            actions.append(
                Action(
                    name="search",
                    args={"query": objective},
                    expected_value=0.78,
                    cost=self.tools["search"].cost,
                    risk=self.tools["search"].risk,
                )
            )
        if "execute" in self.tools:
            actions.append(
                Action(
                    name="execute",
                    args={"objective": objective},
                    expected_value=0.72,
                    cost=self.tools["execute"].cost,
                    risk=self.tools["execute"].risk,
                )
            )
        actions.append(
            Action(
                name="internal_reasoning",
                args={"objective": objective},
                expected_value=max(t.value * t.confidence for t in thoughts),
                cost=0.02,
                risk=max(t.risk for t in thoughts) * 0.25,
            )
        )
        return sorted(actions, key=lambda a: a.score, reverse=True)

    async def run_action(self, action: Action, budget: Budget) -> Dict[str, Any]:
        if action.name == "internal_reasoning":
            return {
                "ok": True,
                "result": (
                    "Best internal path: minimize cost, increase certainty, "
                    f"execute only high-value steps for {action.args['objective']}."
                ),
                "confidence": 0.68,
            }
        tool = self.tools.get(action.name)
        if not tool:
            return {"ok": False, "error": "Tool unavailable", "confidence": 0.2}
        if not budget.allow_tool():
            return {"ok": False, "error": "Tool budget exhausted", "confidence": 0.3}
        budget.tool_calls += 1
        try:
            return await tool.fn(action.args)
        except Exception as e:  # noqa: BLE001 - surface tool errors as observations
            return {"ok": False, "error": repr(e), "confidence": 0.15}

    def evaluate(self, objective: str, observations: List[Dict[str, Any]]) -> Dict[str, Any]:
        good = [o for o in observations if o.get("ok")]
        confidence = clamp(
            sum(float(o.get("confidence", 0.5)) for o in good) / max(len(good), 1)
        )
        errors = [o.get("error") for o in observations if not o.get("ok")]
        return {
            "objective": objective,
            "confidence": confidence,
            "useful_observations": good,
            "errors": errors,
            "complete": confidence >= 0.72 or len(good) >= 2,
        }

    def learn(self, objective: str, result: Dict[str, Any]) -> None:
        confidence = float(result.get("confidence", 0.5))
        self.memory.remember(
            text=(
                f"Objective: {objective}. Result confidence: {confidence}. "
                f"Outcome: {json.dumps(result, default=str)[:1200]}"
            ),
            kind="experience",
            importance=clamp(0.35 + confidence * 0.55),
            confidence=confidence,
        )
        self.memory.believe(
            key=f"strategy:{stable_hash(objective) % 100000}",
            value="Use cheap evidence first, then execute only if expected value beats cost.",
            confidence=confidence,
            evidence=objective,
        )

    async def think(self, objective: str, budget: Optional[Budget] = None) -> Dict[str, Any]:
        budget = budget or Budget()
        observations: List[Dict[str, Any]] = []
        memories = self.memory.recall(objective, k=8)
        thoughts = self.decompose(objective, memories)

        while budget.allow_step():
            budget.steps += 1
            actions = self.choose_actions(objective, thoughts, budget)
            if not actions:
                break
            best = actions[0]
            if best.score < 0.05:
                observations.append(
                    {
                        "ok": True,
                        "result": "Stopped because expected value no longer justified cost.",
                        "confidence": 0.74,
                    }
                )
                break
            obs = await self.run_action(best, budget)
            observations.append(obs)
            result = self.evaluate(objective, observations)
            if result["complete"] and result["confidence"] >= budget.min_confidence:
                self.learn(objective, result)
                self.memory.compress()
                return result

        result = self.evaluate(objective, observations)
        self.learn(objective, result)
        self.memory.compress()
        return result


# ── Standalone demo (the operator-provided example, intact) ──────────
async def example_search(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args["query"]
    return {"ok": True, "result": f"Retrieved evidence relevant to: {query}", "confidence": 0.76}


async def example_execute(args: Dict[str, Any]) -> Dict[str, Any]:
    objective = args["objective"]
    return {
        "ok": True,
        "result": f"Executed smallest safe next action for: {objective}",
        "confidence": 0.73,
    }


async def _demo() -> None:
    brain = Brain(":memory:")
    brain.register_tool(
        Tool(name="search", fn=example_search, cost=0.12, risk=0.04, description="Retrieves external evidence.")
    )
    brain.register_tool(
        Tool(name="execute", fn=example_execute, cost=0.22, risk=0.12, description="Executes a bounded action.")
    )
    brain.memory.remember(
        "When tasks are difficult or expensive, gather cheap high-signal evidence before acting.",
        kind="principle",
        importance=0.95,
        confidence=0.92,
    )
    result = await brain.think(
        "Build an efficient adaptive admin worker that learns, remembers, plans, and executes difficult tasks safely.",
        Budget(max_steps=10, max_seconds=5, max_tool_calls=4, min_confidence=0.7),
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(_demo())
