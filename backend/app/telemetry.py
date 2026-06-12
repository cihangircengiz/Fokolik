from datetime import datetime, timezone

_STATUS = {}

def update_worker_status(worker_name: str, status: str, error: str = None):
    _STATUS[worker_name] = {
        "last_sync": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "error": error
    }

def get_system_status():
    return _STATUS
