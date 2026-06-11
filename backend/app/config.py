from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./football_betting.db"
    NESINE_API_URL: str = "https://data.nesine.com/bulletin"
    SCRAPE_INTERVAL_SECONDS: int = 60

    class Config:
        env_file = ".env"

settings = Settings()
