"""
Coupon settlement engine.

When a match finishes, this module evaluates all pending slip selections
that reference that match and determines if each selection won or lost.
When all selections in a slip are resolved, the slip itself is settled
and winnings (if any) are credited to the user's balance.
"""
import logging
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger("settlement")

# Settlement rules: each bet_type maps to a function that takes a Match
# and returns True if the bet is won.
SETTLEMENT_RULES = {
    "MS 1": lambda m: m.home_score > m.away_score,
    "MS 0": lambda m: m.home_score == m.away_score,
    "MS 2": lambda m: m.away_score > m.home_score,
    "2.5 Üst": lambda m: (m.home_score + m.away_score) >= 3,
    "2.5 Alt": lambda m: (m.home_score + m.away_score) <= 2,
    "KG Var": lambda m: m.home_score > 0 and m.away_score > 0,
    "KG Yok": lambda m: m.home_score == 0 or m.away_score == 0,
    "İY 1": lambda m: m.ht_home_score > m.ht_away_score,
    "İY 0": lambda m: m.ht_home_score == m.ht_away_score,
    "İY 2": lambda m: m.ht_away_score > m.ht_home_score,
}


def settle_finished_matches(db: Session, finished_match_ids: list) -> list:
    """
    Process all pending slip selections for the given finished match IDs.

    Returns a list of settled slip dicts:
      [{"slip_id": 1, "status": "won", "user_id": 3, "payout": 150.0}, ...]
    """
    if not finished_match_ids:
        return []

    settled_slips = []

    # 1. Find all pending SlipSelections whose odd references a finished match
    pending_selections = (
        db.query(models.SlipSelection)
        .join(models.Odd, models.SlipSelection.odd_id == models.Odd.id)
        .filter(
            models.Odd.match_id.in_(finished_match_ids),
            models.SlipSelection.status == "pending",
        )
        .all()
    )

    if not pending_selections:
        return []

    logger.info(f"Found {len(pending_selections)} pending selections for {len(finished_match_ids)} finished matches.")

    # 2. Evaluate each selection
    for sel in pending_selections:
        odd = db.query(models.Odd).filter(models.Odd.id == sel.odd_id).first()
        if not odd:
            continue

        match = db.query(models.Match).filter(models.Match.id == odd.match_id).first()
        if not match or match.status != "finished":
            continue

        rule = SETTLEMENT_RULES.get(odd.bet_type)
        if rule is None:
            logger.warning(f"No settlement rule for bet_type '{odd.bet_type}'. Skipping selection {sel.id}.")
            continue

        try:
            won = rule(match)
        except Exception as e:
            logger.error(f"Error evaluating rule for {odd.bet_type} on match {match.id}: {e}")
            continue

        sel.status = "won" if won else "lost"
        logger.info(
            f"Selection {sel.id} ({odd.bet_type}) on {match.home_team} {match.home_score}-{match.away_score} {match.away_team}: {'WON' if won else 'LOST'}"
        )

    db.flush()

    # 3. Check if any slips are now fully resolved
    # Get unique slip IDs from the selections we just evaluated
    affected_slip_ids = set(sel.slip_id for sel in pending_selections)

    for slip_id in affected_slip_ids:
        slip = db.query(models.Slip).filter(models.Slip.id == slip_id).first()
        if not slip or slip.status != "pending":
            continue

        selections = db.query(models.SlipSelection).filter(
            models.SlipSelection.slip_id == slip_id
        ).all()

        # Check if all selections are resolved (no more "pending")
        statuses = [s.status for s in selections]
        if "pending" in statuses:
            continue  # Still waiting for other matches

        # All resolved — determine slip outcome
        if all(s == "won" for s in statuses):
            slip.status = "won"
            payout = round(slip.amount * slip.total_odd, 2)

            # Credit winnings to user
            user = db.query(models.User).filter(models.User.id == slip.user_id).first()
            if user:
                user.coin_balance += payout
                logger.info(
                    f"Slip {slip.id} WON! User '{user.username}' gets {payout} coins "
                    f"({slip.amount} × {slip.total_odd}). New balance: {user.coin_balance}"
                )

            settled_slips.append({
                "slip_id": slip.id,
                "status": "won",
                "user_id": slip.user_id,
                "payout": payout,
            })
        else:
            slip.status = "lost"
            logger.info(f"Slip {slip.id} LOST. No payout.")
            settled_slips.append({
                "slip_id": slip.id,
                "status": "lost",
                "user_id": slip.user_id,
                "payout": 0,
            })

    # 4. Check for Battle Completions
    if affected_slip_ids:
        # Find all battles that involve these slips
        affected_participants = db.query(models.BattleParticipant).filter(
            models.BattleParticipant.slip_id.in_(affected_slip_ids)
        ).all()
        affected_battle_ids = set(p.battle_id for p in affected_participants)

        for b_id in affected_battle_ids:
            battle = db.query(models.Battle).filter(models.Battle.id == b_id).first()
            if not battle or battle.status != "active":
                continue

            # Check if ALL participants in this battle have finished slips
            participants = db.query(models.BattleParticipant).filter(
                models.BattleParticipant.battle_id == b_id
            ).all()

            slip_ids_in_battle = [p.slip_id for p in participants]
            slips_in_battle = db.query(models.Slip).filter(models.Slip.id.in_(slip_ids_in_battle)).all()

            statuses_in_battle = [s.status for s in slips_in_battle]
            if "pending" in statuses_in_battle:
                continue  # Battle is still ongoing

            # Battle is finished! Resolve points.
            logger.info(f"Battle {battle.invite_code} (ID: {battle.id}) has finished. Resolving points...")
            
            won_slips = [s for s in slips_in_battle if s.status == "won"]
            
            if not won_slips:
                # Everyone lost
                logger.info(f"Battle {battle.invite_code} finished with NO winners.")
                for p in participants:
                    p.earned_points = 0
            else:
                # Find the maximum odds among the winning slips
                max_odd = max(s.total_odd for s in won_slips)
                
                # Find the unique user_ids who hit that max_odd
                winning_slips = [s for s in won_slips if s.total_odd == max_odd]
                winning_user_ids = set([s.user_id for s in winning_slips])
                
                if len(winning_user_ids) == 1:
                    # Single winner -> 3 points
                    winner_id = list(winning_user_ids)[0]
                    logger.info(f"Battle {battle.invite_code} single winner is User {winner_id} with {max_odd} odds. 3 Points awarded.")
                    for p in participants:
                        if p.user_id == winner_id:
                            p.earned_points = 3
                        else:
                            p.earned_points = 0
                else:
                    # Tie -> 1 point each
                    logger.info(f"Battle {battle.invite_code} tie between users {winning_user_ids} with {max_odd} odds. 1 Point each.")
                    for p in participants:
                        if p.user_id in winning_user_ids:
                            p.earned_points = 1
                        else:
                            p.earned_points = 0

            battle.status = "completed"

    db.commit()
    return settled_slips
