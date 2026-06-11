"""
WebSocket connection manager for broadcasting live match updates
and coupon settlement notifications to connected clients.
"""
import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger("ws_manager")


class ConnectionManager:
    """Manages WebSocket connections and broadcasts messages to all connected clients."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send a JSON message to all connected clients."""
        if not self.active_connections:
            return

        data = json.dumps(message, ensure_ascii=False, default=str)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_match_updates(self, updated_matches: list):
        """Broadcast live match score updates."""
        if not updated_matches:
            return
        await self.broadcast({
            "type": "match_updates",
            "data": updated_matches,
        })

    async def broadcast_slip_settled(self, slip_id: int, status: str, user_id: int, payout: float = 0):
        """Broadcast coupon settlement notification."""
        await self.broadcast({
            "type": "slip_settled",
            "data": {
                "slip_id": slip_id,
                "status": status,
                "user_id": user_id,
                "payout": payout,
            }
        })


# Global singleton instance
manager = ConnectionManager()
