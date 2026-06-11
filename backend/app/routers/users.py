from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime

from app import models, schemas, crud
from app.database import get_db

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.get("/{username}/profile", response_model=schemas.UserProfileResponse)
def get_user_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Sadece bu ay içindeki itibar puanlarını topla
    now = datetime.datetime.now()
    start_of_month = datetime.datetime(now.year, now.month, 1)
    
    reputation = db.query(func.sum(models.BattleParticipant.earned_points))\
        .join(models.Battle, models.Battle.id == models.BattleParticipant.battle_id)\
        .filter(
            models.BattleParticipant.user_id == user.id,
            models.Battle.created_at >= start_of_month
        ).scalar() or 0
        
    # Geçmiş kuponları (en son yapılan 20 kuponu) getir
    slips = crud.get_slips_by_user(db=db, user_id=user.id, limit=20)
        
    return schemas.UserProfileResponse(
        user_id=user.id,
        username=user.username,
        coin_balance=user.coin_balance,
        reputation=int(reputation),
        slips=slips
    )
