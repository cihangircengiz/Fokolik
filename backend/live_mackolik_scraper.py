"""
Mackolik Live Score Scraper — Canlı skor güncellemeleri için arka plan servisi.

Mackolik'in JSON API'sini kullanarak canlı maç verilerini çeker,
DB'deki maçları günceller ve WebSocket üzerinden UI'a bildirim gönderir.

Veri Kaynağı:
  https://www.mackolik.com/perform/p0/ajax/components/competition/livescores/json

Mackolik maç verileri iddaaCode alanı ile Nesine maç kodlarını içerir.
Bu sayede mevcut veritabanındaki maçlarla eşleşme sağlanır.
"""
import time
import sys
import logging
import httpx
from datetime import datetime
from sqlalchemy.orm import Session

sys.path.append(".")

from app.database import SessionLocal
from app.models import Match
from app.settlement import settle_finished_matches
from app.telemetry import update_worker_status

if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("live_mackolik")

MACKOLIK_JSON_URL = "https://www.mackolik.com/perform/p0/ajax/components/competition/livescores/json"
BROADCAST_URL = "http://127.0.0.1:8000/system/broadcast"
UPDATE_INTERVAL = 15  # seconds between polls

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


def map_mackolik_status(state: str, substate: str) -> str:
    """Map Mackolik state/substate to our internal match status."""
    if state == "post":
        if substate == "fullTime":
            return "finished"
        if substate == "postponed":
            return "postponed"
        return "finished"  # fallback for any other post state
    if state == "live":
        if substate == "halfTime":
            return "half_time"
        return "live"  # firstHalf, secondHalf, extraTime etc.
    return "not_started"


def get_minute_display(state: str, substate: str, status_box: str | None) -> str:
    """Extract minute/status display text from Mackolik data."""
    if state == "post":
        return "MS"
    if state == "live":
        if substate == "halfTime":
            return "İY"
        if status_box:
            return status_box  # e.g. "75'", "45'+2"
        return ""
    return ""


def fetch_mackolik_matches() -> dict:
    """
    Fetch today's live scores from Mackolik JSON API.
    Returns a dict of {iddaaCode: match_data} for matches that have an iddaaCode.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    params = {
        "sports[]": "Soccer",
        "matchDate": today,
    }
    headers = {
        "User-Agent": USER_AGENTS[0],
        "Accept": "application/json",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Referer": "https://www.mackolik.com/futbol/canli-sonuclar",
    }

    try:
        resp = httpx.get(
            MACKOLIK_JSON_URL,
            params=params,
            headers=headers,
            timeout=15,
            verify=False,
        )
        resp.raise_for_status()
        data = resp.json()

        matches_dict = data.get("data", {}).get("matches", {})
        
        # Build lookup by iddaaCode (which matches our Match.id from Nesine)
        result = {}
        for match in matches_dict.values():
            iddaa_code = match.get("iddaaCode")
            if iddaa_code:
                result[str(iddaa_code)] = match

        return result

    except Exception as e:
        logger.error(f"Mackolik API fetch failed: {e}")
        return {}


def post_broadcast(payload: dict):
    """Post WebSocket payload to FastAPI endpoint for broadcasting to UI."""
    try:
        resp = httpx.post(BROADCAST_URL, json=payload, timeout=5)
        if resp.status_code != 200:
            logger.warning(f"Broadcast HTTP status error: {resp.status_code}")
    except Exception as e:
        logger.debug(f"Failed to post broadcast: {e}")


def process_mackolik_updates(db: Session, mackolik_matches: dict) -> tuple:
    """
    Compare Mackolik live data with DB records and update changed matches.
    
    Returns:
        (updated_matches_data, newly_finished_ids)
    """
    updated_matches_data = []
    newly_finished_ids = []

    for iddaa_code, mdata in mackolik_matches.items():
        # Only process matches that exist in our DB
        db_match = db.query(Match).filter(Match.id == iddaa_code).first()
        if not db_match:
            continue

        # Extract state info
        state = mdata.get("state", "pre")
        substate = mdata.get("substate", "none")
        status_box = mdata.get("statusBoxContent")

        new_status = map_mackolik_status(state, substate)
        minute_display = get_minute_display(state, substate, status_box)

        # Extract scores
        score = mdata.get("score", {})
        try:
            home_score = int(score.get("home", 0) or 0)
            away_score = int(score.get("away", 0) or 0)
        except (ValueError, TypeError):
            home_score = 0
            away_score = 0

        ht_data = score.get("ht") or {}
        try:
            ht_home = int(ht_data.get("home", 0) or 0)
            ht_away = int(ht_data.get("away", 0) or 0)
        except (ValueError, TypeError):
            ht_home = 0
            ht_away = 0

        # Track finish transitions
        was_finished_before = db_match.status == "finished"
        is_finished_now = new_status == "finished"

        # Check if anything changed
        changed = (
            db_match.status != new_status
            or db_match.home_score != home_score
            or db_match.away_score != away_score
            or db_match.minute != minute_display
            or db_match.ht_home_score != ht_home
            or db_match.ht_away_score != ht_away
        )

        if changed:
            db_match.status = new_status
            db_match.home_score = home_score
            db_match.away_score = away_score
            db_match.minute = minute_display
            db_match.ht_home_score = ht_home
            db_match.ht_away_score = ht_away

            updated_matches_data.append({
                "id": db_match.id,
                "home_team": db_match.home_team,
                "away_team": db_match.away_team,
                "status": new_status,
                "home_score": home_score,
                "away_score": away_score,
                "minute": minute_display,
                "ht_home_score": ht_home,
                "ht_away_score": ht_away,
            })

            if is_finished_now and not was_finished_before:
                newly_finished_ids.append(iddaa_code)
                logger.info(
                    f"Match FINISHED: {db_match.home_team} {home_score}-{away_score} {db_match.away_team} "
                    f"(HT: {ht_home}-{ht_away})"
                )
            elif new_status in ("live", "half_time"):
                logger.info(
                    f"Live update: {db_match.home_team} {home_score}-{away_score} {db_match.away_team} "
                    f"[{minute_display}]"
                )

    if updated_matches_data:
        db.commit()

    return updated_matches_data, newly_finished_ids


def run_cycle(db: Session):
    """Run one live score update cycle."""
    # 1. Fetch Mackolik live data
    mackolik_matches = fetch_mackolik_matches()

    if not mackolik_matches:
        logger.debug("No matches with iddaaCode returned from Mackolik.")
        return

    logger.info(f"Fetched {len(mackolik_matches)} matches with iddaaCode from Mackolik.")

    # 2. Process updates
    updated_matches, newly_finished_ids = process_mackolik_updates(db, mackolik_matches)

    # 3. Broadcast live updates to UI
    if updated_matches:
        logger.info(f"Broadcasting {len(updated_matches)} match updates.")
        post_broadcast({
            "type": "match_updates",
            "data": updated_matches,
        })

    # 4. Settle finished matches
    if newly_finished_ids:
        logger.info(f"Settling {len(newly_finished_ids)} finished matches...")
        settled = settle_finished_matches(db, newly_finished_ids)
        if settled:
            logger.info(f"Settled {len(settled)} slips.")
            for s in settled:
                post_broadcast({
                    "type": "slip_settled",
                    "data": {
                        "slip_id": s["slip_id"],
                        "status": s["status"],
                        "user_id": s["user_id"],
                        "payout": s["payout"],
                    },
                })

    update_worker_status("live_worker", "ok")


def main():
    logger.info("Starting Mackolik Live Score Worker...")
    logger.info(f"Update interval: {UPDATE_INTERVAL} seconds")
    logger.info(f"Data source: {MACKOLIK_JSON_URL}")

    while True:
        db = SessionLocal()
        try:
            run_cycle(db)
        except Exception as e:
            logger.error(f"Error in live worker cycle: {e}", exc_info=True)
            update_worker_status("live_worker", "error", str(e))
        finally:
            db.close()

        time.sleep(UPDATE_INTERVAL)


if __name__ == "__main__":
    main()
