"""
Live Score Worker — runs as a separate background process.

Every 60 seconds:
1. Fetches live match results from Nesine's Live API
2. Updates Match records in the database (score, status, minute)
3. Settles finished match coupons via the settlement engine
4. Broadcasts updates to WebSocket clients
"""
import time
import sys
import asyncio
import logging
import httpx
import random
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Match, Odd, Slip, SlipSelection
from app.settlement import settle_finished_matches
from app.ws_manager import manager
from app.telemetry import update_worker_status

if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("live_worker")

LIVE_API_URL = "https://ls.nesine.com/api/v2/Bet/GetLiveBetResultsWithVersion"
UPDATE_INTERVAL = 60  # seconds

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

# Nesine Status (S) → Our match status mapping
# S=1: Not started yet (shows in live list but hasn't kicked off)
# S=2: In progress (1st or 2nd half)
# S=4: Half time
# S=5: Finished (normal time)
# S=17: Extra time
# S=23: Finished with extra time / penalties
# S=30: Postponed
# S=39: Finished (another variant)
FINISHED_STATUSES = {5, 23, 39}
LIVE_STATUSES = {1, 2, 14, 15, 17}
HALFTIME_STATUSES = {4}


def map_nesine_status(s: int, period: int = 0) -> str:
    """Map Nesine status code to our match status string."""
    if s in FINISHED_STATUSES:
        return "finished"
    if s in HALFTIME_STATUSES:
        return "half_time"
    if s in LIVE_STATUSES:
        # Determine 1st or 2nd half from score entries
        # We'll use a simple heuristic: if HT score exists and differs, it's 2nd half
        return "live"  # We'll refine this with half-time score detection
    if s == 30 or s == 31:
        return "postponed"
    return "not_started"


def fetch_live_results(version: int = 0) -> tuple:
    """
    Fetch live match results from Nesine's API.
    Returns (results_list, new_version).
    """
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "application/json",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Referer": "https://www.nesine.com/iddaa",
        "Origin": "https://www.nesine.com",
    }

    try:
        resp = httpx.get(
            f"{LIVE_API_URL}?v={version}",
            headers=headers,
            timeout=15,
            verify=False
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("d", [])
        return results, version
    except Exception as e:
        logger.error(f"Failed to fetch live results: {e}")
        return [], version


def process_live_results(db: Session, results: list) -> tuple:
    """
    Process live results and update matching records in the database.

    Returns:
        (updated_matches_data, newly_finished_ids)
        - updated_matches_data: list of dicts with match info for WS broadcast
        - newly_finished_ids: list of match IDs that just finished
    """
    # Filter for football results only (BTIP=1)
    football_results = [r for r in results if r.get("BTIP") == 1]

    if not football_results:
        return [], []

    updated_matches_data = []
    newly_finished_ids = []

    for result in football_results:
        match_code = str(result.get("C", ""))
        if not match_code:
            continue

        # Find match in our DB
        db_match = db.query(Match).filter(Match.id == match_code).first()
        if not db_match:
            continue

        # Extract score from ES (Event Scores)
        es = result.get("ES", [])
        home_score = 0
        away_score = 0
        ht_home = 0
        ht_away = 0

        for score_entry in es:
            score_type = score_entry.get("T", 0)
            if score_type == 1:  # Full match score
                home_score = score_entry.get("H", 0)
                away_score = score_entry.get("A", 0)
            elif score_type == 2:  # First half score
                ht_home = score_entry.get("H", 0)
                ht_away = score_entry.get("A", 0)

        # Map status
        nesine_status = result.get("S", 0)
        new_status = map_nesine_status(nesine_status, result.get("P", 0))

        # Determine minute display
        dt = result.get("DT", "")
        minute_display = ""
        if new_status == "live":
            minute_display = dt  # DT contains something like "45'" or time
        elif new_status == "half_time":
            minute_display = "İY"
        elif new_status == "finished":
            minute_display = "MS"

        # Track if this match just finished
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
                newly_finished_ids.append(match_code)
                logger.info(
                    f"Match FINISHED: {db_match.home_team} {home_score}-{away_score} {db_match.away_team} "
                    f"(HT: {ht_home}-{ht_away})"
                )
            elif changed and new_status in ("live", "half_time"):
                logger.info(
                    f"Live update: {db_match.home_team} {home_score}-{away_score} {db_match.away_team} "
                    f"[{minute_display}]"
                )

    if updated_matches_data:
        db.commit()

    return updated_matches_data, newly_finished_ids


def run_cycle(db: Session, version: int) -> int:
    """Run one live update cycle."""
    # 1. Fetch live results
    results, new_version = fetch_live_results(version)

    if not results:
        logger.debug("No live results returned.")
        return new_version

    logger.info(f"Fetched {len(results)} live results from API.")

    # 2. Process and update matches in DB
    updated_matches, newly_finished_ids = process_live_results(db, results)

    if updated_matches:
        logger.info(f"Updated {len(updated_matches)} matches in database.")

        # 3. Broadcast match updates via WebSocket
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(manager.broadcast_match_updates(updated_matches))
            else:
                loop.run_until_complete(manager.broadcast_match_updates(updated_matches))
        except RuntimeError:
            # No event loop running — create one
            asyncio.run(manager.broadcast_match_updates(updated_matches))
        except Exception as e:
            logger.debug(f"WebSocket broadcast skipped (no clients): {e}")

    # 4. Settle finished matches
    if newly_finished_ids:
        logger.info(f"Settling {len(newly_finished_ids)} newly finished matches...")
        settled = settle_finished_matches(db, newly_finished_ids)
        if settled:
            logger.info(f"Settled {len(settled)} slips.")
            for s in settled:
                try:
                    asyncio.run(manager.broadcast_slip_settled(
                        s["slip_id"], s["status"], s["user_id"], s["payout"]
                    ))
                except Exception:
                    pass

    return new_version


def main():
    logger.info("Starting Live Score Worker...")
    logger.info(f"Update interval: {UPDATE_INTERVAL} seconds")
    logger.info(f"Live API: {LIVE_API_URL}")

    version = 0

    while True:
        db = SessionLocal()
        try:
            version = run_cycle(db, version)
            update_worker_status("live_worker", "ok")
        except Exception as e:
            logger.error(f"Error in live worker cycle: {e}", exc_info=True)
            update_worker_status("live_worker", "error", str(e))
        finally:
            db.close()

        time.sleep(UPDATE_INTERVAL)


if __name__ == "__main__":
    main()
