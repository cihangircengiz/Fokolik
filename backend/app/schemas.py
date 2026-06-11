from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional

# --- Odd Schemas ---
class OddBase(BaseModel):
    bet_type: str
    odd_value: float

class OddCreate(OddBase):
    pass

class OddResponse(OddBase):
    id: int
    match_id: str

    model_config = ConfigDict(from_attributes=True)

# --- Match Schemas ---
class MatchBase(BaseModel):
    id: str  # Bulletin code
    home_team: str
    away_team: str
    start_date: datetime

class MatchCreate(MatchBase):
    pass

class MatchResponse(MatchBase):
    odds: List[OddResponse] = []
    # Live score fields
    status: str = "not_started"
    home_score: int = 0
    away_score: int = 0
    minute: str = ""
    ht_home_score: int = 0
    ht_away_score: int = 0
    league: str = "Bilinmeyen Lig"

    model_config = ConfigDict(from_attributes=True)

# --- User Schemas ---
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    coin_balance: float

    model_config = ConfigDict(from_attributes=True)

# --- Slip (Kupon) Schemas ---
class SlipCreate(BaseModel):
    odd_ids: List[int]
    amount: float

class SlipSelectionDetails(BaseModel):
    id: int
    bet_type: str
    odd_value: float
    match_id: str
    home_team: str
    away_team: str
    start_date: datetime
    # Live score fields for tracking
    match_status: str = "not_started"
    home_score: int = 0
    away_score: int = 0
    minute: str = ""
    league: str = "Bilinmeyen Lig"

class SlipSelectionResponse(BaseModel):
    id: int
    slip_id: int
    odd_id: int
    status: str
    odd_details: Optional[SlipSelectionDetails] = None

    model_config = ConfigDict(from_attributes=True)

class SlipResponse(BaseModel):
    id: int
    user_id: int
    amount: float
    total_odd: float
    status: str
    created_at: datetime
    selections: List[SlipSelectionResponse] = []

    model_config = ConfigDict(from_attributes=True)
