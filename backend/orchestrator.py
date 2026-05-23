"""
HomeOS — Agent orchestration layer.

Each incoming chat message is routed through a deterministic pipeline of
named agents. Agents are loosely coupled, side-effect-aware functions; the
orchestrator owns the order, parallelism, and the broadcast contract.

         ┌──────────────────────────┐
user msg │      ChatOrchestrator    │ → persisted + broadcast
─────────┤                          │
         │  1. InstagramAgent       │  if URL detected → fetch + recipe → cart
         │  2. ChatAgent            │  decides reply / extract groceries
         │  3. CartProposerAgent    │  posts proposal when ≥4 items
         └──────────────────────────┘
                     │
                     ▼
            broadcaster.publish()   (SSE → all connected clients)
            db.chat_messages.insert (persistent log)

All agents:
  - Are async functions taking `(household_id, user, content, db, llm_key)`
  - Return `AgentResult(messages: list[dict], updated_cart: bool)`
  - Are individually unit-testable

This file is the orchestration glue. Heavy agent logic still lives in
server.py for now (see _run_jarvis, _process_instagram_link,
_get_or_create_draft_cart) — this module documents the contract and
provides the lightweight dispatcher.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Awaitable, List


@dataclass
class AgentResult:
    messages: List[dict] = field(default_factory=list)
    cart_updated: bool = False
    short_circuit: bool = False  # if True, skip subsequent agents


AgentFn = Callable[[str, dict, str], Awaitable[AgentResult]]


class ChatOrchestrator:
    """Sequential dispatcher. Each agent can short-circuit the pipeline."""

    def __init__(self) -> None:
        self._agents: List[tuple[str, AgentFn]] = []

    def register(self, name: str, fn: AgentFn) -> None:
        self._agents.append((name, fn))

    async def dispatch(self, household_id: str, user: dict, content: str) -> AgentResult:
        combined = AgentResult()
        for name, fn in self._agents:
            try:
                r = await fn(household_id, user, content)
            except Exception as e:  # noqa: BLE001
                import logging
                logging.getLogger(__name__).exception(f"agent {name} crashed: {e}")
                continue
            combined.messages.extend(r.messages)
            combined.cart_updated = combined.cart_updated or r.cart_updated
            if r.short_circuit:
                break
        return combined


orchestrator = ChatOrchestrator()
