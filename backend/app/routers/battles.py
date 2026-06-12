import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List

from app import models, schemas, crud
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(
    prefix="/battles",
    tags=["Battles"]
)

def get_battle_earliest_start(db: Session, battle_id: int):
    earliest = db.query(func.min(models.Match.start_date))\
        .select_from(models.BattleMatch)\
        .join(models.Match, models.Match.id == models.BattleMatch.match_id)\
        .filter(models.BattleMatch.battle_id == battle_id)\
        .scalar()
    return earliest

@router.post("/", response_model=schemas.BattleResponse)
def create_battle(battle_in: schemas.BattleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if len(battle_in.match_ids) < 2 or len(battle_in.match_ids) > 5:
        raise HTTPException(status_code=400, detail="Düello en az 2, en fazla 5 maç içerebilir.")
        
    # Davet kodu üret (8 Haneli)
    invite_code = str(uuid.uuid4())[:8].upper()
    db_battle = models.Battle(
        creator_id=current_user.id,
        invite_code=invite_code,
        is_public=battle_in.is_public,
        max_participants=battle_in.max_participants
    )
    db.add(db_battle)
    db.commit()
    db.refresh(db_battle)
    
    for m_id in battle_in.match_ids:
        db_match = db.query(models.Match).filter(models.Match.id == m_id).first()
        if not db_match:
            raise HTTPException(status_code=400, detail=f"Maç {m_id} bulunamadı.")
        bm = models.BattleMatch(battle_id=db_battle.id, match_id=m_id)
        db.add(bm)
        
    db.commit()
    return get_battle_by_code(invite_code, db)

@router.get("/public", response_model=List[schemas.BattleResponse])
def get_public_battles(db: Session = Depends(get_db)):
    now = datetime.datetime.now()
    battles = db.query(models.Battle).filter(
        models.Battle.is_public == True,
        models.Battle.status == "active"
    ).order_by(models.Battle.created_at.desc()).all()
    
    valid_battles = []
    for b in battles:
        earliest = get_battle_earliest_start(db, b.id)
        # Sadece saati geçmemiş düelloları Lobi'de göster
        if earliest and earliest > now:
            valid_battles.append(get_battle_by_code(b.invite_code, db))
            
    return valid_battles

@router.get("/my", response_model=List[schemas.BattleResponse])
def get_my_battles(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    b_ids = db.query(models.BattleParticipant.battle_id).filter(models.BattleParticipant.user_id == current_user.id).distinct().all()
    b_ids = [r[0] for r in b_ids]
    
    result = []
    for bid in b_ids:
        b = db.query(models.Battle).filter(models.Battle.id == bid).first()
        if b:
            result.append(get_battle_by_code(b.invite_code, db))
    return result

@router.get("/leaderboard", response_model=List[schemas.LeaderboardUser])
def get_leaderboard(db: Session = Depends(get_db)):
    now = datetime.datetime.now()
    start_of_month = datetime.datetime(now.year, now.month, 1)
    
    results = db.query(
        models.BattleParticipant.user_id,
        models.User.username,
        func.sum(models.BattleParticipant.earned_points).label("reputation"),
        func.sum(case((models.BattleParticipant.earned_points > 0, 1), else_=0)).label("won_battles")
    ).join(models.User, models.User.id == models.BattleParticipant.user_id)\
     .join(models.Battle, models.Battle.id == models.BattleParticipant.battle_id)\
     .filter(models.Battle.created_at >= start_of_month)\
     .group_by(models.BattleParticipant.user_id, models.User.username)\
     .order_by(func.sum(models.BattleParticipant.earned_points).desc())\
     .limit(50).all()
     
    return [
        schemas.LeaderboardUser(
            user_id=r[0],
            username=r[1],
            reputation=r[2] or 0,
            monthly_won_battles=r[3] or 0
        )
        for r in results
    ]

@router.get("/{invite_code}", response_model=schemas.BattleResponse)
def get_battle_by_code(invite_code: str, db: Session = Depends(get_db)):
    battle = db.query(models.Battle).filter(models.Battle.invite_code == invite_code).first()
    if not battle:
        raise HTTPException(status_code=404, detail="Düello bulunamadı.")
        
    creator = db.query(models.User).filter(models.User.id == battle.creator_id).first()
    
    matches = [bm.match for bm in battle.matches]
        
    parts = []
    for p in battle.participants:
        user = db.query(models.User).filter(models.User.id == p.user_id).first()
        slip = db.query(models.Slip).filter(models.Slip.id == p.slip_id).first()
        formatted_slip = crud.format_slip(db, slip) if slip else None
        parts.append(schemas.BattleParticipantResponse(
            id=p.id,
            user_id=p.user_id,
            username=user.username if user else "",
            slip_id=p.slip_id,
            earned_points=p.earned_points,
            slip=formatted_slip
        ))
        
    calculated_status = battle.status
    if calculated_status == "active":
        earliest = get_battle_earliest_start(db, battle.id)
        if earliest and earliest <= datetime.datetime.now():
            calculated_status = "started"

    return schemas.BattleResponse(
        id=battle.id,
        creator_id=battle.creator_id,
        creator_username=creator.username if creator else "",
        invite_code=battle.invite_code,
        status=calculated_status,
        is_public=battle.is_public,
        max_participants=battle.max_participants,
        created_at=battle.created_at,
        matches=matches,
        participants=parts
    )

@router.post("/{invite_code}/join")
def join_battle(invite_code: str, slip_in: schemas.SlipCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    battle = db.query(models.Battle).filter(models.Battle.invite_code == invite_code).first()
    if not battle:
        raise HTTPException(status_code=404, detail="Düello bulunamadı.")
        
    if battle.status != "active":
        raise HTTPException(status_code=400, detail="Bu düello çoktan sonuçlanmış.")
        
    if battle.max_participants:
        unique_users = db.query(models.BattleParticipant.user_id).filter(models.BattleParticipant.battle_id == battle.id).distinct().count()
        is_in = db.query(models.BattleParticipant).filter(models.BattleParticipant.battle_id == battle.id, models.BattleParticipant.user_id == current_user.id).first()
        if not is_in and unique_users >= battle.max_participants:
            raise HTTPException(status_code=400, detail="Kişi limiti dolmuş.")
            
    earliest = get_battle_earliest_start(db, battle.id)
    if earliest and earliest <= datetime.datetime.now():
        raise HTTPException(status_code=400, detail="Düellodaki maçlardan biri başlamış, katılıma kapalı.")
        
    battle_match_ids = set([bm.match_id for bm in battle.matches])
    
    total_odd = 1.0
    for odd_id in slip_in.odd_ids:
        odd = db.query(models.Odd).filter(models.Odd.id == odd_id).first()
        if not odd:
            raise HTTPException(status_code=400, detail="Oran bulunamadı.")
        if odd.match_id not in battle_match_ids:
            raise HTTPException(status_code=400, detail="Seçtiğin maç bu düelloda bulunmuyor.")
        total_odd *= odd.odd_value
        
    if len(slip_in.odd_ids) != len(battle_match_ids):
        raise HTTPException(status_code=400, detail="Düellodaki TÜM maçlar için bir tahmin yapmalısın.")
        
    if current_user.coin_balance < slip_in.amount:
        raise HTTPException(status_code=400, detail="Coin bakiyen yetersiz.")
        
    current_user.coin_balance -= slip_in.amount
    
    db_slip = models.Slip(
        user_id=current_user.id,
        amount=slip_in.amount,
        total_odd=total_odd,
        status="pending"
    )
    db.add(db_slip)
    db.commit()
    db.refresh(db_slip)
    
    for odd_id in slip_in.odd_ids:
        odd = db.query(models.Odd).filter(models.Odd.id == odd_id).first()
        db_sel = models.SlipSelection(slip_id=db_slip.id, odd_id=odd_id, odd_value=odd.odd_value)
        db.add(db_sel)
        
    bp = models.BattleParticipant(
        battle_id=battle.id,
        user_id=current_user.id,
        slip_id=db_slip.id,
        earned_points=0
    )
    db.add(bp)
    db.commit()
    
    return {"message": "Düelloya başarıyla katıldın!", "slip_id": db_slip.id}
