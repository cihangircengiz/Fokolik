import logging
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.database import SessionLocal
from app.ws_manager import manager
from app.settlement import settle_finished_matches
from app.telemetry import update_worker_status
from scraper.mackolik_fetcher import process_mackolik_matches
from scraper.fetcher import process_nesine_odds
from datetime import datetime

logger = logging.getLogger("scheduler")

scheduler = AsyncIOScheduler()

async def job_mackolik_live_updates():
    """Fetches live scores from Mackolik, updates DB, broadcasts and settles."""
    db = SessionLocal()
    try:
        updated_matches, newly_finished_ids = process_mackolik_matches(db, days_forward=3)
        
        if updated_matches:
            logger.info(f"Broadcasting {len(updated_matches)} match updates.")
            await manager.broadcast_match_updates(updated_matches)
            
        if newly_finished_ids:
            logger.info(f"Settling {len(newly_finished_ids)} finished matches...")
            settled = settle_finished_matches(db, newly_finished_ids)
            if settled:
                for s in settled:
                    await manager.broadcast_slip_settled(s["slip_id"], s["status"], s["user_id"], s["payout"])
        
        update_worker_status("live_worker", "ok")

    except Exception as e:
        update_worker_status("live_worker", "error", str(e))
        logger.error(f"Error in Mackolik job: {e}", exc_info=True)
    finally:
        db.close()

async def job_nesine_odds():
    """Fetches odds from Nesine and matches them to Mackolik matches in DB."""
    db = SessionLocal()
    try:
        process_nesine_odds(db)
        update_worker_status("bulletin_worker", "ok")
    except Exception as e:
        update_worker_status("bulletin_worker", "error", str(e))
        logger.error(f"Error in Nesine job: {e}", exc_info=True)
    finally:
        db.close()

def start_scheduler():
    logger.info("Starting APScheduler...")
    scheduler.add_job(
        job_mackolik_live_updates,
        trigger=IntervalTrigger(seconds=15),
        id="mackolik_live_updates",
        name="Mackolik Live Updates",
        replace_existing=True,
        next_run_time=datetime.now()
    )
    
    scheduler.add_job(
        job_nesine_odds,
        trigger=IntervalTrigger(hours=1),
        id="nesine_odds",
        name="Nesine Odds Matcher",
        replace_existing=True,
        next_run_time=datetime.now()
    )
    
    scheduler.start()

def stop_scheduler():
    logger.info("Stopping APScheduler...")
    scheduler.shutdown()
