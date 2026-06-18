import logging
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.ws_manager import manager
from app.settlement import settle_finished_matches
from app.telemetry import update_worker_status
from scraper.mackolik_fetcher import process_mackolik_matches
from scraper.fetcher import process_nesine_odds
from app.battles_reward import distribute_monthly_rewards
from app.odds_integrity import check_and_fix_odds
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
                    
        # Check and settle stale/voided matches (e.g. 4 hours past start time)
        from app.settlement import settle_voided_matches
        voided = settle_voided_matches(db, max_hours_past=4)
        if voided:
            for s in voided:
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
        updated_matches = await asyncio.to_thread(process_nesine_odds, db)
        if updated_matches:
            logger.info(f"Broadcasting odds updates for {len(updated_matches)} matches.")
            await manager.broadcast_match_updates(updated_matches)
            
        update_worker_status("bulletin_worker", "ok")
    except Exception as e:
        update_worker_status("bulletin_worker", "error", str(e))
        logger.error(f"Error in Nesine job: {e}", exc_info=True)
    finally:
        db.close()

async def check_and_fix_odds_job():
    """Runs the odds integrity checker."""
    db = SessionLocal()
    try:
        await asyncio.to_thread(check_and_fix_odds, db)
    except Exception as e:
        logger.error(f"Error in odds integrity job: {e}", exc_info=True)
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
        trigger=IntervalTrigger(minutes=1),
        id="nesine_odds",
        name="Nesine Odds Matcher",
        replace_existing=True,
        next_run_time=datetime.now()
    )
    
    # Run the odds integrity worker every 2 minutes to fix bad odds automatically
    scheduler.add_job(
        check_and_fix_odds_job,
        trigger=IntervalTrigger(minutes=2),
        id="odds_integrity",
        name="Odds Integrity Checker",
        replace_existing=True,
        next_run_time=datetime.now()
    )
    
    # Run on the 1st day of every month at 00:01
    scheduler.add_job(
        distribute_monthly_rewards,
        trigger=CronTrigger(day=1, hour=0, minute=1),
        id="monthly_battle_rewards",
        name="Monthly Battle Rewards",
        replace_existing=True
    )
    
    scheduler.start()

def stop_scheduler():
    logger.info("Stopping APScheduler...")
    scheduler.shutdown()
