"""
Nesine bulletin fetcher using the official CDN JSON API.

Uses https://cdnbulten.nesine.com/api/bulten/getprebultenfull
which returns ALL pre-match events across all sports and dates in a single call.

We filter for football (TYPE=1) and extract the relevant markets/odds.
"""
import httpx
import random
import logging
import json
import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import Match, Odd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fetcher")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
]

# Nesine Market Type IDs (MTID) we care about
MARKET_TYPES = {
    1: {
        # MTID 1 = Maç Sonucu (Match Result) — 3-way: 1, X, 2
        "name": "Maç Sonucu",
        "outcomes": {
            1: "MS 1",   # Home win
            2: "MS 0",   # Draw
            3: "MS 2",   # Away win
        }
    },
    3: {
        # MTID 3 = İlk Yarı Sonucu (First Half Result) — 3-way
        "name": "İlk Yarı Sonucu",
        "outcomes": {
            1: "İY 1",   # Home leads at half-time
            2: "İY 0",   # Draw at half-time
            3: "İY 2",   # Away leads at half-time
        }
    },
    8: {
        # MTID 8 = Çifte Şans (Double Chance)
        "name": "Çifte Şans",
        "outcomes": {
            1: "ÇŞ 1-X",
            2: "ÇŞ 1-2",
            3: "ÇŞ X-2",
        }
    },
    12: {
        # MTID 12 = Alt/Üst (Over/Under 2.5) — typically SOV=2.5
        "name": "Alt/Üst",
        "outcomes": {
            1: "2.5 Alt",
            2: "2.5 Üst",
        }
    },
    13: {
        # MTID 13 = Alt/Üst 3.5
        "name": "Alt/Üst 3.5",
        "outcomes": {
            1: "3.5 Alt",
            2: "3.5 Üst",
        }
    },
    14: {
        # MTID 14 = Alt/Üst 1.5
        "name": "Alt/Üst 1.5",
        "outcomes": {
            1: "1.5 Alt",
            2: "1.5 Üst",
        }
    },
    43: {
        # MTID 43 = Toplam Gol Aralığı
        "name": "Toplam Gol Aralığı",
        "outcomes": {
            1: "TG 0-1",
            2: "TG 2-3",
            3: "TG 4-5",
            4: "TG 6+",
        }
    },
    48: {
        # MTID 48 = İlk Yarı Çifte Şans
        "name": "İlk Yarı Çifte Şans",
        "outcomes": {
            1: "İY ÇŞ 1-X",
            2: "İY ÇŞ 1-2",
            3: "İY ÇŞ X-2",
        }
    },
    49: {
        # MTID 49 = İlk Yarı 1.5 Alt/Üst
        "name": "İlk Yarı 1.5 Alt/Üst",
        "outcomes": {
            1: "İY 1.5 Alt",
            2: "İY 1.5 Üst",
        }
    },
    295: {
        # MTID 295 = Ev Sahibi Gol Alt/Üst 0.5
        "name": "Ev Sahibi Gol Alt/Üst 0.5",
        "outcomes": {
            1: "Ev 0.5 Alt",
            2: "Ev 0.5 Üst",
        }
    },
    450: {
        # MTID 450 = Karşılıklı Gol (Both Teams To Score)
        "name": "Karşılıklı Gol",
        "outcomes": {
            1: "KG Var",
            2: "KG Yok",
        }
    },
}


class NesineFetcher:
    def __init__(self, api_url: str = None):
        self.api_url = "https://cdnbulten.nesine.com/api/bulten/getprebultenfull"
        self.min_days = 3  # Minimum number of days to fetch

    def fetch_bulletin(self) -> list:
        """
        Fetches the full pre-match bulletin from Nesine CDN API,
        filters for football events across at least 3 days,
        and extracts match info + odds.
        """
        logger.info(f"Fetching Nesine pre-bulletin from API: {self.api_url}")

        try:
            headers = {
                "User-Agent": random.choice(USER_AGENTS),
                "Accept": "application/json",
                "Accept-Language": "tr-TR,tr;q=0.9",
                "Referer": "https://www.nesine.com/iddaa",
                "Origin": "https://www.nesine.com",
            }

            # Added verify=False to bypass [SSL: CERTIFICATE_VERIFY_FAILED] issues
            resp = httpx.get(self.api_url, headers=headers, timeout=20, verify=False)
            resp.raise_for_status()
            data = resp.json()

            events = data.get("sg", {}).get("EA", [])
            logger.info(f"API returned {len(events)} total events.")

            # Map league IDs to league details
            leagues_list = data.get("sg", {}).get("LA", [])
            leagues_map = {str(l.get("LID", "")): l for l in leagues_list}

            # Filter for football events (TYPE=1) that are actual matches (have HN and AN)
            football_events = [
                e for e in events
                if e.get("TYPE") == 1
                and e.get("HN")
                and e.get("AN")
                # Exclude special bets like "Şampiyon Kim Olur" which have weird team names
                and not any(kw in (e.get("HN", "") + e.get("AN", "")).lower()
                           for kw in ["şampiyon", "kim olur", "çifte şans", "dünya kupası"])
            ]
            logger.info(f"Found {len(football_events)} football matches in API response.")

            # Determine which dates to include (at least self.min_days)
            today = datetime.now().date()
            target_dates = set()
            for i in range(self.min_days):
                d = today + timedelta(days=i)
                target_dates.add(d.strftime("%d.%m.%Y"))

            # Also include any additional dates up to 7 days out to be generous
            for i in range(self.min_days, 7):
                d = today + timedelta(days=i)
                target_dates.add(d.strftime("%d.%m.%Y"))

            parsed_matches = []
            dates_seen = set()

            for event in football_events:
                event_date_str = event.get("D", "")

                # Only include events within our target date range
                if event_date_str not in target_dates:
                    continue

                dates_seen.add(event_date_str)

                match_code = str(event.get("C", ""))
                home_team = event.get("HN", "Ev Sahibi")
                away_team = event.get("AN", "Deplasman")

                # Define TRT (Turkey Time) timezone
                TRT = timezone(timedelta(hours=3))

                # Parse start date from epoch milliseconds
                esd = event.get("ESD", 0)
                if esd:
                    start_date = datetime.fromtimestamp(esd / 1000, tz=TRT)
                else:
                    # Fallback: parse from D and T fields
                    time_str = event.get("T", "00:00")
                    try:
                        naive_dt = datetime.strptime(f"{event_date_str} {time_str}", "%d.%m.%Y %H:%M")
                        start_date = naive_dt.replace(tzinfo=TRT)
                    except ValueError:
                        start_date = datetime.now(TRT)

                # Extract odds from MA (Markets Array)
                odds_list = self._extract_odds(event.get("MA", []))

                # Skip matches without any useful odds
                if not odds_list:
                    continue

                # Get the league name
                league_id = str(event.get("LC", ""))
                league_info = leagues_map.get(league_id, {})
                league_name = league_info.get("N", "Bilinmeyen Lig")

                parsed_matches.append({
                    "id": match_code,
                    "home_team": home_team,
                    "away_team": away_team,
                    "start_date": start_date,
                    "odds": odds_list,
                    "league": league_name,
                })

            # Log summary
            logger.info(f"Parsed {len(parsed_matches)} football matches across {len(dates_seen)} days.")
            for d in sorted(dates_seen):
                day_count = sum(1 for m in parsed_matches if m["start_date"].strftime("%d.%m.%Y") == d)
                logger.info(f"  {d}: {day_count} matches")

            if parsed_matches:
                return parsed_matches
            else:
                raise ValueError("No football matches could be parsed from the API response.")

        except Exception as e:
            logger.error(f"API fetch failed: {str(e)}", exc_info=True)

        return []

    def _extract_odds(self, markets: list) -> list:
        """
        Extract odds from the markets array (MA) of an event.
        We look for specific Market Type IDs (MTID):
          - MTID 1: Maç Sonucu (MS 1, MS 0, MS 2)
          - MTID 12: Alt/Üst 2.5 Gol (2.5 Alt, 2.5 Üst) — only when SOV is around 2.5
        """
        odds_list = []

        for market in markets:
            mtid = market.get("MTID")

            if mtid not in MARKET_TYPES:
                continue

            # Verify the SOV line matches the expected type
            if mtid == 12 and market.get("SOV", 0) != 2.5:
                continue
            if mtid == 13 and market.get("SOV", 0) != 3.5:
                continue
            if mtid == 14 and market.get("SOV", 0) != 1.5:
                continue
            if mtid == 49 and market.get("SOV", 0) != 1.5:
                continue
            if mtid == 295 and market.get("SOV", 0) != 0.5:
                continue

            config = MARKET_TYPES[mtid]
            outcomes = market.get("OCA", [])

            for oc in outcomes:
                outcome_n = oc.get("N")
                odd_value = oc.get("O")

                if outcome_n in config["outcomes"] and odd_value is not None:
                    bet_type = config["outcomes"][outcome_n]
                    try:
                        odd_val = float(odd_value)
                    except (ValueError, TypeError):
                        continue

                    odds_list.append({
                        "bet_type": bet_type,
                        "odd_value": odd_val,
                    })

        return odds_list

def process_nesine_odds(db: Session):
    fetcher = NesineFetcher()
    try:
        nesine_matches = fetcher.fetch_bulletin()
    except Exception as e:
        logger.error(f"Failed to fetch nesine bulletin: {e}")
        return []

    updated_matches_data = []

    for mdata in nesine_matches:
        match_id = str(mdata["id"])
        
        # Check if match exists in DB (created by Mackolik)
        db_match = db.query(Match).filter(Match.id == match_id).first()
        if not db_match:
            continue
            
        # Update or create odds
        odds_changed = False
        for odd_data in mdata["odds"]:
            bet_type = odd_data["bet_type"]
            odd_value = odd_data["odd_value"]
            
            db_odd = db.query(Odd).filter(
                Odd.match_id == match_id,
                Odd.bet_type == bet_type
            ).first()
            
            if db_odd:
                if db_odd.odd_value != odd_value:
                    db_odd.odd_value = odd_value
                    odds_changed = True
            else:
                db_odd = Odd(
                    match_id=match_id,
                    bet_type=bet_type,
                    odd_value=odd_value
                )
                db.add(db_odd)
                odds_changed = True
                
        if odds_changed:
            db.flush()
            # Fetch all current odds for this match to broadcast
            all_odds = db.query(Odd).filter(Odd.match_id == match_id).all()
            odds_payload = [
                {"id": o.id, "bet_type": o.bet_type, "odd_value": o.odd_value}
                for o in all_odds
            ]
            updated_matches_data.append({
                "id": match_id,
                "odds": odds_payload
            })
                
    db.commit()
    logger.info(f"Successfully updated Nesine odds. {len(updated_matches_data)} matches had odd changes.")
    return updated_matches_data
