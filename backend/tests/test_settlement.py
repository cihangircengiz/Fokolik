import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from app.models import Base, User, Match, Odd, Slip, SlipSelection
from app.settlement import settle_finished_matches

@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_settlement_won(db_session):
    # Setup Data
    user = User(username="test1", hashed_password="pw", coin_balance=100.0)
    match = Match(id="1", home_team="A", away_team="B", start_date=datetime.now(), status="finished", home_score=2, away_score=1)
    odd = Odd(id=1, match_id="1", bet_type="MS 1", odd_value=2.0)
    
    db_session.add_all([user, match, odd])
    db_session.flush()

    slip = Slip(user_id=user.id, amount=10.0, total_odd=2.0, status="pending")
    db_session.add(slip)
    db_session.flush()

    sel = SlipSelection(slip_id=slip.id, odd_id=odd.id, odd_value=2.0, status="pending")
    db_session.add(sel)
    db_session.commit()

    # Act
    settled = settle_finished_matches(db_session, ["1"])

    # Assert
    assert len(settled) == 1
    assert settled[0]["status"] == "won"
    assert settled[0]["payout"] == 20.0
    
    # check user balance
    db_session.refresh(user)
    assert user.coin_balance == 120.0

def test_settlement_lost(db_session):
    user = User(username="test2", hashed_password="pw", coin_balance=100.0)
    match = Match(id="2", home_team="C", away_team="D", start_date=datetime.now(), status="finished", home_score=1, away_score=1)
    odd = Odd(id=2, match_id="2", bet_type="MS 1", odd_value=2.0)
    
    db_session.add_all([user, match, odd])
    db_session.flush()

    slip = Slip(user_id=user.id, amount=10.0, total_odd=2.0, status="pending")
    db_session.add(slip)
    db_session.flush()

    sel = SlipSelection(slip_id=slip.id, odd_id=odd.id, odd_value=2.0, status="pending")
    db_session.add(sel)
    db_session.commit()

    # Act
    settled = settle_finished_matches(db_session, ["2"])

    # Assert
    assert len(settled) == 1
    assert settled[0]["status"] == "lost"
    assert settled[0]["payout"] == 0
    
    # check user balance
    db_session.refresh(user)
    assert user.coin_balance == 100.0

def test_settlement_pending(db_session):
    user = User(username="test3", hashed_password="pw", coin_balance=100.0)
    match1 = Match(id="3", home_team="E", away_team="F", start_date=datetime.now(), status="finished", home_score=2, away_score=1)
    match2 = Match(id="4", home_team="G", away_team="H", start_date=datetime.now(), status="live", home_score=0, away_score=0)
    
    odd1 = Odd(id=3, match_id="3", bet_type="MS 1", odd_value=2.0)
    odd2 = Odd(id=4, match_id="4", bet_type="MS 1", odd_value=1.5)
    
    db_session.add_all([user, match1, match2, odd1, odd2])
    db_session.flush()

    slip = Slip(user_id=user.id, amount=10.0, total_odd=3.0, status="pending")
    db_session.add(slip)
    db_session.flush()

    sel1 = SlipSelection(slip_id=slip.id, odd_id=odd1.id, odd_value=2.0, status="pending")
    sel2 = SlipSelection(slip_id=slip.id, odd_id=odd2.id, odd_value=1.5, status="pending")
    db_session.add_all([sel1, sel2])
    db_session.commit()

    # Act
    settled = settle_finished_matches(db_session, ["3"])

    # Assert
    assert len(settled) == 0 # Slip is still pending because match2 is not finished
    db_session.refresh(slip)
    assert slip.status == "pending"
    db_session.refresh(sel1)
    assert sel1.status == "won"
    db_session.refresh(sel2)
    assert sel2.status == "pending"
