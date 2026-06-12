import time
import logging
import sys
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Match, Odd, Base
from app.config import settings
from scraper.fetcher import NesineFetcher
from app.telemetry import update_worker_status

if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("worker")

import httpx
from datetime import datetime, timedelta

_mackolik_ids_cache = set()
_last_mackolik_update = 0

def refresh_mackolik_ids():
    global _mackolik_ids_cache, _last_mackolik_update
    now = time.time()
    # Update every 5 minutes (300 seconds)
    if now - _last_mackolik_update < 300 and _mackolik_ids_cache:
        return
        
    logger.info("Refreshing Mackolik match IDs for the next 7 days...")
    new_ids = set()
    url = "https://www.mackolik.com/perform/p0/ajax/components/competition/livescores/json"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Referer": "https://www.mackolik.com/futbol/canli-sonuclar",
    }
    
    base_date = datetime.now()
    for i in range(7):
        date_str = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        params = {
            "sports[]": "Soccer",
            "matchDate": date_str,
        }
        try:
            resp = httpx.get(url, params=params, headers=headers, timeout=10, verify=False)
            if resp.status_code == 200:
                data = resp.json()
                matches_dict = data.get("data", {}).get("matches", {})
                count = 0
                for match in matches_dict.values():
                    iddaa_code = match.get("iddaaCode")
                    if iddaa_code:
                        new_ids.add(str(iddaa_code))
                        count += 1
                logger.info(f"Fetched {count} matches with iddaaCode from Mackolik for {date_str}")
        except Exception as e:
            logger.error(f"Failed to fetch Mackolik matches for {date_str}: {e}")
            
    _mackolik_ids_cache = new_ids
    _last_mackolik_update = now
    logger.info(f"Refreshed Mackolik cache. Total matches found: {len(_mackolik_ids_cache)}")

def update_bulletin(db: Session, fetcher: NesineFetcher):
    try:
        # Refresh mackolik ids cache
        try:
            refresh_mackolik_ids()
        except Exception as e:
            logger.error(f"Failed to refresh Mackolik cache: {e}")

        matches_data = fetcher.fetch_bulletin()
        logger.info(f"Fetched {len(matches_data)} matches. Synchronizing with database...")
        
        for m_data in matches_data:
            match_id_str = str(m_data["id"])
            is_on_mack = match_id_str in _mackolik_ids_cache

            # 1. Match upsert
            db_match = db.query(Match).filter(Match.id == m_data["id"]).first()
            if not db_match:
                db_match = Match(
                    id=m_data["id"],
                    home_team=m_data["home_team"],
                    away_team=m_data["away_team"],
                    start_date=m_data["start_date"],
                    league=m_data.get("league", "Bilinmeyen Lig"),
                    is_on_mackolik=is_on_mack
                )
                db.add(db_match)
                db.flush()  # Generate match in session for foreign keys
                if is_on_mack:
                    logger.info(f"Added new match: {db_match.home_team} vs {db_match.away_team} (Code: {db_match.id})")
            else:
                db_match.home_team = m_data["home_team"]
                db_match.away_team = m_data["away_team"]
                db_match.start_date = m_data["start_date"]
                db_match.league = m_data.get("league", "Bilinmeyen Lig")
                db_match.is_on_mackolik = is_on_mack
            
            # 2. Odds upsert (Preserves Odd.id so Bets aren't broken by Cascade Delete)
            for o_data in m_data["odds"]:
                db_odd = db.query(Odd).filter(
                    Odd.match_id == db_match.id,
                    Odd.bet_type == o_data["bet_type"]
                ).first()
                
                if db_odd:
                    # Check if odd value changed
                    if db_odd.odd_value != o_data["odd_value"]:
                        logger.info(f"Updated odd value for {db_match.home_team} - {o_data['bet_type']} from {db_odd.odd_value} to {o_data['odd_value']}")
                        db_odd.odd_value = o_data["odd_value"]
                else:
                    db_odd = Odd(
                        match_id=db_match.id,
                        bet_type=o_data["bet_type"],
                        odd_value=o_data["odd_value"]
                    )
                    db.add(db_odd)
        
        # Bulk update is_on_mackolik for all matches in the database
        if _mackolik_ids_cache:
            db.query(Match).filter(Match.id.in_(_mackolik_ids_cache)).update({"is_on_mackolik": True}, synchronize_session=False)
            db.query(Match).filter(~Match.id.in_(_mackolik_ids_cache)).update({"is_on_mackolik": False}, synchronize_session=False)

        db.commit()
        logger.info("Database synchronization completed successfully.")
        update_worker_status("bulletin_worker", "ok")
    except Exception as e:
        db.rollback()
        logger.error(f"Error occurred during bulletin update: {str(e)}", exc_info=True)
        update_worker_status("bulletin_worker", "error", str(e))

def main():
    logger.info("Initializing bulletin scraper background worker...")
    fetcher = NesineFetcher(settings.NESINE_API_URL)
    
    interval = settings.SCRAPE_INTERVAL_SECONDS
    logger.info(f"Worker started. Update interval: {interval} seconds.")
    
    while True:
        db = SessionLocal()
        try:
            update_bulletin(db, fetcher)
        finally:
            db.close()
            
        logger.info(f"Sleeping for {interval} seconds...")
        time.sleep(interval)

if __name__ == "__main__":
    main()
