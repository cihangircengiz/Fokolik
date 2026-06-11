from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from typing import List
from . import models, schemas

# --- User CRUD ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

from .auth import get_password_hash

def create_user(db: Session, user: schemas.UserCreate):
    db_user = get_user_by_username(db, user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    hashed_password = get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password, coin_balance=10000.0)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# --- Match & Odd CRUD ---
def get_matches(db: Session, date_str: str = None, skip: int = 0, limit: int = 100):
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            start_of_day = datetime.combine(target_date, datetime.min.time())
            end_of_day = datetime.combine(target_date, datetime.max.time())
            return db.query(models.Match).filter(
                models.Match.start_date.between(start_of_day, end_of_day)
            ).order_by(models.Match.start_date.asc()).offset(skip).limit(limit).all()
        except ValueError:
            pass  # Fallback to default if date string is invalid
            
    # Default: Show matches starting from today's midnight onwards
    today_start = datetime.combine(datetime.now().date(), datetime.min.time())
    return db.query(models.Match).filter(
        models.Match.start_date >= today_start
    ).order_by(models.Match.start_date.asc()).offset(skip).limit(limit).all()

def get_match(db: Session, match_id: str):
    return db.query(models.Match).filter(models.Match.id == match_id).first()

def get_live_matches(db: Session):
    """Get all matches that are currently live or at half time."""
    return db.query(models.Match).filter(
        models.Match.status.in_(["live", "live_1h", "live_2h", "half_time"])
    ).order_by(models.Match.start_date.asc()).all()

# --- Slip (Kupon) CRUD ---
def create_slip(db: Session, slip_data: schemas.SlipCreate, user_id: int):
    # 1. Validate User
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # 2. Validate Balance
    if user.coin_balance < slip_data.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient coin balance"
        )
    
    if slip_data.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slip amount must be greater than 0"
        )

    if not slip_data.odd_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A slip must contain at least one selection"
        )

    # 3. Validate Odds and Matches
    odds_to_add = []
    total_odd = 1.0
    now = datetime.now()

    for odd_id in slip_data.odd_ids:
        odd = db.query(models.Odd).filter(models.Odd.id == odd_id).first()
        if not odd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Odd with ID {odd_id} not found"
            )
        
        match = db.query(models.Match).filter(models.Match.id == odd.match_id).first()
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Match associated with odd {odd_id} not found"
            )
        odds_to_add.append(odd)
        total_odd *= odd.odd_value

    # Same-match restriction removed. A slip can contain multiple selections from the same match.

    try:
        # Deduct balance
        user.coin_balance -= slip_data.amount

        # Create Slip
        db_slip = models.Slip(
            user_id=user_id,
            amount=slip_data.amount,
            total_odd=round(total_odd, 2),
            status="pending"
        )
        db.add(db_slip)
        db.flush()  # Generate db_slip.id

        # Create Selections
        for odd in odds_to_add:
            db_selection = models.SlipSelection(
                slip_id=db_slip.id,
                odd_id=odd.id,
                odd_value=odd.odd_value,
                status="pending"
            )
            db.add(db_selection)

        db.commit()
        db.refresh(db_slip)
        return db_slip
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while creating the slip: {str(e)}"
        )

def get_slips_by_user(db: Session, user_id: int) -> List[schemas.SlipResponse]:
    slips = db.query(models.Slip).filter(models.Slip.user_id == user_id).order_by(models.Slip.created_at.desc()).all()
    response_slips = []

    for slip in slips:
        selections_res = []
        for sel in slip.selections:
            # Load odd and match details
            odd = db.query(models.Odd).filter(models.Odd.id == sel.odd_id).first()
            odd_details = None
            if odd:
                match = db.query(models.Match).filter(models.Match.id == odd.match_id).first()
                if match:
                    odd_details = schemas.SlipSelectionDetails(
                        id=odd.id,
                        bet_type=odd.bet_type,
                        odd_value=sel.odd_value,
                        match_id=match.id,
                        home_team=match.home_team,
                        away_team=match.away_team,
                        start_date=match.start_date,
                        match_status=match.status,
                        home_score=match.home_score,
                        away_score=match.away_score,
                        minute=match.minute,
                        league=match.league,
                    )
            
            sel_res = schemas.SlipSelectionResponse(
                id=sel.id,
                slip_id=sel.slip_id,
                odd_id=sel.odd_id,
                status=sel.status,
                odd_details=odd_details
            )
            selections_res.append(sel_res)

        slip_res = schemas.SlipResponse(
            id=slip.id,
            user_id=slip.user_id,
            amount=slip.amount,
            total_odd=slip.total_odd,
            status=slip.status,
            created_at=slip.created_at,
            selections=selections_res
        )
        response_slips.append(slip_res)

    return response_slips

def cancel_slip(db: Session, slip_id: int, user_id: int):
    # 1. Fetch Slip
    slip = db.query(models.Slip).filter(models.Slip.id == slip_id).first()
    if not slip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slip not found"
        )
        
    if slip.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this slip"
        )

    # 2. Check Status
    if slip.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a slip with status '{slip.status}'"
        )

    # 3. Verify that none of the matches have started yet
    now = datetime.now()
    for sel in slip.selections:
        odd = db.query(models.Odd).filter(models.Odd.id == sel.odd_id).first()
        if odd:
            match = db.query(models.Match).filter(models.Match.id == odd.match_id).first()
            if match and match.start_date <= now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot cancel: match '{match.home_team} vs {match.away_team}' has already started."
                )

    try:
        # 4. Refund User
        user = db.query(models.User).filter(models.User.id == slip.user_id).first()
        if user:
            user.coin_balance += slip.amount

        # 5. Set status to cancelled
        slip.status = "cancelled"
        db.commit()
        db.refresh(slip)
        return slip
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while cancelling the slip: {str(e)}"
        )
