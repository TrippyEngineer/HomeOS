"""
HomeOS — Real-time chat broadcaster (Server-Sent Events).

A simple in-memory pub/sub keyed by household_id. Each connected client gets
an asyncio.Queue; when a new chat message is committed to MongoDB, the
orchestrator pushes it to every queue subscribed to that household.

Works through Kubernetes ingress because SSE is plain HTTP (text/event-stream).
EventSource on the client cannot set Authorization headers, so we accept the
JWT via the `?token=` query parameter on the stream endpoint.
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Dict, Set

logger = logging.getLogger(__name__)


class HouseholdBroadcaster:
    def __init__(self) -> None:
        self._subs: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, household_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._subs.setdefault(household_id, set()).add(q)
        logger.info(f"SSE subscribe household={household_id} count={len(self._subs[household_id])}")
        return q

    async def unsubscribe(self, household_id: str, q: asyncio.Queue) -> None:
        async with self._lock:
            if household_id in self._subs:
                self._subs[household_id].discard(q)
                if not self._subs[household_id]:
                    self._subs.pop(household_id, None)
        logger.info(f"SSE unsubscribe household={household_id}")

    async def publish(self, household_id: str, event: dict) -> None:
        """Fire-and-forget broadcast to all subscribers of a household."""
        async with self._lock:
            queues = list(self._subs.get(household_id, set()))
        if not queues:
            return
        payload = json.dumps(event, default=str)
        for q in queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                # Drop slowest subscriber rather than block the publisher
                logger.warning(f"SSE queue full for household={household_id} — dropping")


# Singleton used across the app
broadcaster = HouseholdBroadcaster()
