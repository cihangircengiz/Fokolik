from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "mssql+pyodbc://sa:YourPassword123@localhost/FokolikDB?driver=ODBC+Driver+17+for+SQL+Server"
    NESINE_API_URL: str = "https://cdnbulten.nesine.com/api/bulten/getprebultenfull"
    MACKOLIK_JSON_URL: str = "https://www.mackolik.com/perform/p0/ajax/components/competition/livescores/json"
    SCRAPE_INTERVAL_SECONDS: int = 60

    class Config:
        env_file = ".env"

settings = Settings()
