from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    coin_balance = Column(Float, default=10000.0, nullable=False)

    slips = relationship("Slip", back_populates="user", cascade="all, delete-orphan")

class Match(Base):
    __tablename__ = "matches"

    id = Column(String, primary_key=True, index=True)
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=False)
    league = Column(String, default="Bilinmeyen Lig", nullable=False)

    # Live score fields
    status = Column(String, default="not_started", nullable=False)  # not_started, live_1h, half_time, live_2h, finished
    home_score = Column(Integer, default=0, nullable=False)
    away_score = Column(Integer, default=0, nullable=False)
    minute = Column(String, default="", nullable=False)  # e.g. "45+2", "HT", "90", "FT"
    ht_home_score = Column(Integer, default=0, nullable=False)  # Half-time home score
    ht_away_score = Column(Integer, default=0, nullable=False)  # Half-time away score
    is_on_mackolik = Column(Boolean, default=False, nullable=False)

    odds = relationship("Odd", back_populates="match", cascade="all, delete-orphan")

class Odd(Base):
    __tablename__ = "odds"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(String, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    bet_type = Column(String, nullable=False)  # e.g., "MS 1", "MS 0", "MS 2", "2.5 Üst", "2.5 Alt"
    odd_value = Column(Float, nullable=False)

    match = relationship("Match", back_populates="odds")
    selections = relationship("SlipSelection", back_populates="odd", cascade="all, delete-orphan")

class Slip(Base):
    __tablename__ = "slips"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    total_odd = Column(Float, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending, won, lost, cancelled
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    user = relationship("User", back_populates="slips")
    selections = relationship("SlipSelection", back_populates="slip", cascade="all, delete-orphan")

class SlipSelection(Base):
    __tablename__ = "slip_selections"

    id = Column(Integer, primary_key=True, index=True)
    slip_id = Column(Integer, ForeignKey("slips.id", ondelete="CASCADE"), nullable=False)
    odd_id = Column(Integer, ForeignKey("odds.id", ondelete="CASCADE"), nullable=False)
    odd_value = Column(Float, nullable=False, server_default='1.0')
    status = Column(String, default="pending", nullable=False)  # pending, won, lost

    slip = relationship("Slip", back_populates="selections")
    odd = relationship("Odd", back_populates="selections")

class Battle(Base):
    __tablename__ = "battles"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invite_code = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="active", nullable=False)  # active, completed
    is_public = Column(Boolean, default=True, nullable=False)
    max_participants = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    creator = relationship("User", foreign_keys=[creator_id])
    matches = relationship("BattleMatch", back_populates="battle", cascade="all, delete-orphan")
    participants = relationship("BattleParticipant", back_populates="battle", cascade="all, delete-orphan")

class BattleMatch(Base):
    __tablename__ = "battle_matches"

    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("battles.id", ondelete="CASCADE"), nullable=False)
    match_id = Column(String, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)

    battle = relationship("Battle", back_populates="matches")
    match = relationship("Match")

class BattleParticipant(Base):
    __tablename__ = "battle_participants"

    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("battles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    slip_id = Column(Integer, ForeignKey("slips.id", ondelete="CASCADE"), nullable=False)
    earned_points = Column(Integer, default=0, nullable=False)

    battle = relationship("Battle", back_populates="participants")
    user = relationship("User")
    slip = relationship("Slip")
