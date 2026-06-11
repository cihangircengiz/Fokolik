from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import schemas, crud, models
from ..auth import get_current_user

router = APIRouter(
    prefix="/slips",
    tags=["slips"]
)

@router.post("/", response_model=schemas.SlipResponse, status_code=status.HTTP_201_CREATED)
def place_slip(slip: schemas.SlipCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_slip(db=db, slip_data=slip, user_id=current_user.id)

@router.get("/my_slips", response_model=List[schemas.SlipResponse])
def read_user_slips(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_slips_by_user(db=db, user_id=current_user.id)

@router.post("/{slip_id}/cancel", response_model=schemas.SlipResponse)
def cancel_user_slip(slip_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # crud.cancel_slip will check if slip belongs to user implicitly, 
    # but let's pass current_user.id to ensure users only cancel their own slips
    return crud.cancel_slip(db=db, slip_id=slip_id, user_id=current_user.id)
