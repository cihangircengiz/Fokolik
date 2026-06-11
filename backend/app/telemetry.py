import json
import os
from datetime import datetime, timezone

STATUS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "worker_status.json")

def update_worker_status(worker_name: str, status: str, error: str = None):
    data = {}
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            pass
            
    data[worker_name] = {
        "last_sync": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "error": error
    }
    
    try:
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Telemetry Error: Could not write status file: {e}")

def get_system_status():
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}
