from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    # `.env` dosyası repo kökünde; çalışma dizinine bağlı kalmadan buradan yükle.
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "dev"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    database_url: str = "sqlite:///./deepcal.db"


settings = Settings()

