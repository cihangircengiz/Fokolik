import logging
import httpx
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models import Match

logger = logging.getLogger("mackolik_fetcher")

MACKOLIK_JSON_URL = "https://www.mackolik.com/perform/p0/ajax/components/competition/livescores/json"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
]

def map_mackolik_status(state: str, substate: str) -> str:
    """Map Mackolik state/substate to our internal match status."""
    if state == "post":
        if substate == "fullTime":
            return "finished"
        if substate == "postponed":
            return "postponed"
        return "finished"
    if state == "live":
        if substate == "halfTime":
            return "half_time"
        return "live"
    return "not_started"

def get_minute_display(state: str, substate: str, status_box: str | None, mdata: dict | None = None) -> str:
    if state == "post":
        return "MS"
    if state == "live":
        if substate == "halfTime":
            return "İY"
        if status_box:
            return str(status_box)
            
        if mdata and mdata.get("status") == "minutes":
            period_start = mdata.get("periodStart")
            period_id = mdata.get("periodId", 1)
            
            if period_start:
                now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
                elapsed_ms = now_ms - period_start
                elapsed_mins = max(0, int(elapsed_ms / 60000))
                
                if period_id == 1:
                    minute = elapsed_mins
                    if minute > 45: return "45+"
                elif period_id == 2:
                    minute = 45 + elapsed_mins
                    if minute > 90: return "90+"
                elif period_id == 3:
                    minute = 90 + elapsed_mins
                elif period_id == 4:
                    minute = 105 + elapsed_mins
                else:
                    minute = elapsed_mins
                    
                return str(minute)
        return ""
    return ""

def fetch_mackolik_data_for_date(date_str: str) -> dict:
    """Fetch Mackolik data for a specific date (YYYY-MM-DD)."""
    params = {
        "sports[]": "Soccer",
        "matchDate": date_str,
    }
    headers = {
        "User-Agent": USER_AGENTS[0],
        "Accept": "application/json",
        "Accept-Language": "tr-TR,tr;q=0.9",
        "Referer": "https://www.mackolik.com/futbol/canli-sonuclar",
    }

    try:
        resp = httpx.get(
            MACKOLIK_JSON_URL,
            params=params,
            headers=headers,
            timeout=15,
            verify=False,
        )
        resp.raise_for_status()
        return resp.json().get("data", {})
    except Exception as e:
        logger.error(f"Mackolik API fetch failed for {date_str}: {e}")
        return {}

def process_mackolik_matches(db: Session, days_forward: int = 3):
    """
    Fetch matches from Mackolik for the next few days,
    create them in DB if they don't exist (and have iddaaCode),
    and update their status/scores if they do exist.
    """
    today = datetime.now()
    dates_to_fetch = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days_forward)]

    updated_matches_data = []
    newly_finished_ids = []

    for date_str in dates_to_fetch:
        data = fetch_mackolik_data_for_date(date_str)
        if not data:
            continue

        matches_dict = data.get("matches", {})
        competitions_dict = data.get("competitions", {})

        for m_id, mdata in matches_dict.items():
            iddaa_code = mdata.get("iddaaCode")
            if not iddaa_code:
                continue
                
            iddaa_code_str = str(iddaa_code)

            # Get league name
            comp_id = mdata.get("competitionId")
            league_name = "Bilinmeyen Lig"
            if comp_id and comp_id in competitions_dict:
                league_name = competitions_dict[comp_id].get("name", "Bilinmeyen Lig")

            home_team = mdata.get("homeTeam", {}).get("name", "Ev Sahibi")
            away_team = mdata.get("awayTeam", {}).get("name", "Deplasman")
            
            # Start date
            mst_utc = mdata.get("mstUtc")
            if mst_utc:
                # Assuming mst_utc is milliseconds
                start_date = datetime.fromtimestamp(mst_utc / 1000, tz=timezone(timedelta(hours=3))).replace(tzinfo=None)
            else:
                start_date = datetime.now()

            # State & Scores
            state = mdata.get("state", "pre")
            substate = mdata.get("substate", "none")
            status_box = mdata.get("statusBoxContent")

            # DB Operations
            db_match = db.query(Match).filter(Match.id == iddaa_code_str).first()

            new_status = map_mackolik_status(state, substate)
            
            # Prevent reverting canceled matches back to not_started if they are stale on Mackolik
            if db_match and db_match.status == "canceled" and new_status == "not_started":
                new_status = "canceled"
                
            minute_display = get_minute_display(state, substate, status_box, mdata)

            score = mdata.get("score", {})
            try:
                home_score = int(score.get("home", 0) or 0)
                away_score = int(score.get("away", 0) or 0)
            except (ValueError, TypeError):
                home_score = 0
                away_score = 0

            ht_data = score.get("ht") or {}
            try:
                ht_home = int(ht_data.get("home", 0) or 0)
                ht_away = int(ht_data.get("away", 0) or 0)
            except (ValueError, TypeError):
                ht_home = 0
                ht_away = 0
            
            if not db_match:
                db_match = Match(
                    id=iddaa_code_str,
                    home_team=home_team,
                    away_team=away_team,
                    start_date=start_date,
                    league=league_name,
                    status=new_status,
                    home_score=home_score,
                    away_score=away_score,
                    minute=minute_display,
                    ht_home_score=ht_home,
                    ht_away_score=ht_away,
                    is_on_mackolik=True
                )
                db.add(db_match)
                # Ensure we have the match for the next check loop
                db.flush()
                continue # newly created, no need to broadcast update if it's just pre-match usually, but we could.
                
            # Update existing
            was_finished_before = db_match.status == "finished"
            is_finished_now = new_status == "finished"

            changed = (
                db_match.status != new_status
                or db_match.home_score != home_score
                or db_match.away_score != away_score
                or db_match.minute != minute_display
                or db_match.ht_home_score != ht_home
                or db_match.ht_away_score != ht_away
            )

            if changed:
                db_match.status = new_status
                db_match.home_score = home_score
                db_match.away_score = away_score
                db_match.minute = minute_display
                db_match.ht_home_score = ht_home
                db_match.ht_away_score = ht_away

                updated_matches_data.append({
                    "id": db_match.id,
                    "home_team": db_match.home_team,
                    "away_team": db_match.away_team,
                    "status": new_status,
                    "home_score": home_score,
                    "away_score": away_score,
                    "minute": minute_display,
                    "ht_home_score": ht_home,
                    "ht_away_score": ht_away,
                })

                if is_finished_now and not was_finished_before:
                    newly_finished_ids.append(iddaa_code_str)

    db.commit()
    return updated_matches_data, newly_finished_ids
