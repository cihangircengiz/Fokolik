import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import calendar

from app import models
from app.database import SessionLocal

logger = logging.getLogger("battles_reward")

def distribute_monthly_rewards():
    """
    Distributes rewards to the top 2 users on the battle leaderboard for the previous month.
    This should be run on the 1st of every month.
    """
    db = SessionLocal()
    try:
        now = datetime.now()
        # Find the start and end of the PREVIOUS month
        first_day_of_current_month = datetime(now.year, now.month, 1)
        last_day_of_prev_month = first_day_of_current_month - timedelta(days=1)
        start_of_prev_month = datetime(last_day_of_prev_month.year, last_day_of_prev_month.month, 1)
        
        # Check if rewards were already distributed for this month to prevent duplicates
        # We can look for a transaction/history log, but for now we'll just log it.
        # It's better to run this exactly once.
        
        results = db.query(
            models.BattleParticipant.user_id,
            func.sum(models.BattleParticipant.earned_points).label("reputation")
        ).join(models.Battle, models.Battle.id == models.BattleParticipant.battle_id)\
         .filter(models.Battle.created_at >= start_of_prev_month)\
         .filter(models.Battle.created_at < first_day_of_current_month)\
         .group_by(models.BattleParticipant.user_id)\
         .order_by(func.sum(models.BattleParticipant.earned_points).desc())\
         .limit(2).all()

        if not results:
            logger.info("No battle participants found for the previous month.")
            return

        rewards = {0: 50000, 1: 25000}
        
        for index, row in enumerate(results):
            user_id = row[0]
            reputation = row[1]
            
            if reputation <= 0:
                continue # No reward if reputation is not positive
                
            reward_amount = rewards.get(index, 0)
            if reward_amount > 0:
                user = db.query(models.User).filter(models.User.id == user_id).first()
                if user:
                    user.coin_balance += reward_amount
                    logger.info(f"Rewarded {reward_amount} coins to user_id {user_id} ({user.username}) for ranking #{index+1} in Battles.")
        
        db.commit()
        logger.info("Successfully distributed monthly battle rewards.")
    except Exception as e:
        logger.error(f"Error distributing monthly rewards: {e}")
        db.rollback()
    finally:
        db.close()
