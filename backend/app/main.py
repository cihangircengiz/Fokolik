from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, matches, slips
from .ws_manager import manager
from .telemetry import get_system_status

app = FastAPI(
    title="Football Betting Simulation API",
    description="Backend for football betting simulation game.",
    version="2.0.0"
)

# Configure CORS so our React frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.5.0.1:3000",
        "https://fokolik.pages.dev"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(matches.router)
app.include_router(slips.router)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Football Betting Simulation API!",
        "docs_url": "/docs"
    }

@app.get("/system/status")
def system_status():
    return get_system_status()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time match updates and coupon settlement notifications."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive by waiting for any message
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
