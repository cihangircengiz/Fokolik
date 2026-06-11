import time
import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Match, Odd, Base
from app.config import settings
from scraper.fetcher import NesineFetcher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("worker")

def update_bulletin(db: Session, fetcher: NesineFetcher):
    try:
        matches_data = fetcher.fetch_bulletin()
        logger.info(f"Fetched {len(matches_data)} matches. Synchronizing with database...")
        
        for m_data in matches_data:
            # 1. Match upsert
            db_match = db.query(Match).filter(Match.id == m_data["id"]).first()
            if not db_match:
                db_match = Match(
                    id=m_data["id"],
                    home_team=m_data["home_team"],
                    away_team=m_data["away_team"],
                    start_date=m_data["start_date"],
                    league=m_data.get("league", "Bilinmeyen Lig")
                )
                db.add(db_match)
                db.flush()  # Generate match in session for foreign keys
                logger.info(f"Added new match: {db_match.home_team} vs {db_match.away_team} (Code: {db_match.id})")
            else:
                db_match.home_team = m_data["home_team"]
                db_match.away_team = m_data["away_team"]
                db_match.start_date = m_data["start_date"]
                db_match.league = m_data.get("league", "Bilinmeyen Lig")
            
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
        
        db.commit()
        logger.info("Database synchronization completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error occurred during bulletin update: {str(e)}", exc_info=True)

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
