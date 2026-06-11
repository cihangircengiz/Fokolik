from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
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
    status = Column(String, default="pending", nullable=False)  # pending, won, lost

    slip = relationship("Slip", back_populates="selections")
    odd = relationship("Odd", back_populates="selections")
