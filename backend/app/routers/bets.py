from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import schemas, crud

router = APIRouter(
    prefix="/bets",
    tags=["bets"]
)

@router.post("/", response_model=schemas.BetResponse, status_code=status.HTTP_201_CREATED)
def place_bet(bet: schemas.BetCreate, db: Session = Depends(get_db)):
    return crud.create_bet(db=db, bet=bet)

@router.get("/user/{user_id}", response_model=List[schemas.BetResponse])
def read_user_bets(user_id: int, db: Session = Depends(get_db)):
    return crud.get_bets_by_user(db=db, user_id=user_id)
