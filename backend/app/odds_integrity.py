import logging
from sqlalchemy.orm import Session
from app.models import Match, Odd

logger = logging.getLogger("odds_integrity")

def check_and_fix_odds(db: Session):
    """
    Scans all active matches and checks for logical inconsistencies in odds.
    If inconsistencies are found (e.g. 1.5 Üst odd > 2.5 Üst odd), it fixes them
    by correctly sorting and reassigning the values.
    """
    try:
        # Get all matches that haven't started yet
        active_matches = db.query(Match).filter(Match.status == "not_started").all()
        fixed_count = 0
        
        for match in active_matches:
            match_odds = db.query(Odd).filter(Odd.match_id == match.id).all()
            if not match_odds:
                continue
                
            odds_dict = {o.bet_type: o for o in match_odds}
            changed = False
            
            # Rule 1: Üst (Over) odds should increase as the threshold increases
            # 1.5 Üst < 2.5 Üst < 3.5 Üst
            ust_types = ["1.5 Üst", "2.5 Üst", "3.5 Üst"]
            ust_objs = [odds_dict.get(t) for t in ust_types if odds_dict.get(t)]
            if len(ust_objs) > 1:
                vals = [o.odd_value for o in ust_objs]
                if vals != sorted(vals):
                    # They are out of order! Fix them by sorting ascending
                    sorted_vals = sorted(vals)
                    for obj, correct_val in zip(ust_objs, sorted_vals):
                        if obj.odd_value != correct_val:
                            obj.odd_value = correct_val
                            changed = True
                            
            # Rule 2: Alt (Under) odds should decrease as the threshold increases
            # 1.5 Alt > 2.5 Alt > 3.5 Alt
            alt_types = ["1.5 Alt", "2.5 Alt", "3.5 Alt"]
            alt_objs = [odds_dict.get(t) for t in alt_types if odds_dict.get(t)]
            if len(alt_objs) > 1:
                vals = [o.odd_value for o in alt_objs]
                # They should be descending
                if vals != sorted(vals, reverse=True):
                    sorted_vals = sorted(vals, reverse=True)
                    for obj, correct_val in zip(alt_objs, sorted_vals):
                        if obj.odd_value != correct_val:
                            obj.odd_value = correct_val
                            changed = True
            
            # Rule 3: İY 1 should be > 1.10 generally if MS 1 is not like 1.01.
            # If İY 1 is absurdly low (< 1.10) but MS 1 is normal (> 1.20), it's likely a mapping error.
            # We can't perfectly guess the right odd, but we can void it or set it to a realistic minimum to prevent abuse.
            ms1 = odds_dict.get("MS 1")
            iy1 = odds_dict.get("İY 1")
            if ms1 and iy1:
                if iy1.odd_value < 1.10 and ms1.odd_value > 1.20:
                    # Fix absurdly low İY 1 odd by bumping it slightly above MS 1
                    iy1.odd_value = ms1.odd_value * 1.2
                    changed = True
                    logger.warning(f"Fixed suspiciously low İY 1 odd for match {match.id}")

            if changed:
                fixed_count += 1
                
        if fixed_count > 0:
            db.commit()
            logger.info(f"Odds integrity worker fixed odds for {fixed_count} matches.")
            
    except Exception as e:
        logger.error(f"Error in odds integrity worker: {e}", exc_info=True)
        db.rollback()
