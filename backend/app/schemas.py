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
    updated_at: Optional[datetime] = None

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
    odd_value: float = 1.0
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

# --- Battle Schemas ---
class BattleCreate(BaseModel):
    match_ids: List[str]
    is_public: bool = True
    max_participants: Optional[int] = None

class BattleParticipantResponse(BaseModel):
    id: int
    user_id: int
    username: str = ""
    slip_id: int
    earned_points: int
    slip: Optional[SlipResponse] = None

    model_config = ConfigDict(from_attributes=True)

class BattleResponse(BaseModel):
    id: int
    creator_id: int
    creator_username: str = ""
    invite_code: str
    status: str
    is_public: bool
    max_participants: Optional[int]
    created_at: datetime
    matches: List[MatchResponse] = []
    participants: List[BattleParticipantResponse] = []

    model_config = ConfigDict(from_attributes=True)

class LeaderboardUser(BaseModel):
    user_id: int
    username: str
    reputation: int
    monthly_won_battles: int

class UserProfileResponse(BaseModel):
    user_id: int
    username: str
    coin_balance: float
    reputation: int
    slips: List[SlipResponse] = []
