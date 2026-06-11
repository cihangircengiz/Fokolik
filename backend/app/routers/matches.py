from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from .. import schemas, crud

router = APIRouter(
    prefix="/matches",
    tags=["matches"]
)

@router.get("/live", response_model=List[schemas.MatchResponse])
def read_live_matches(db: Session = Depends(get_db)):
    """Get all currently live matches (in progress or at half time)."""
    return crud.get_live_matches(db)

@router.get("/", response_model=List[schemas.MatchResponse])
def read_matches(date: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    matches = crud.get_matches(db, date_str=date, skip=skip, limit=limit)
    return matches
