import sqlite3
from datetime import datetime, timezone

from .config import settings


def _db_path_from_url(url: str) -> str:
    # MVP: sadece sqlite dosya yolu desteklenir (sqlite:///./deepcal.db)
    if not url.startswith("sqlite:///"):
        raise ValueError("MVP sadece sqlite:/// URL destekler.")
    return url.removeprefix("sqlite:///")


def get_conn() -> sqlite3.Connection:
    path = _db_path_from_url(settings.database_url)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS meal_entries (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at TEXT NOT NULL,
              food_name TEXT NOT NULL,
              portion TEXT NOT NULL,
              multiplier REAL NOT NULL,
              calories_kcal REAL NOT NULL,
              protein_g REAL NOT NULL,
              fat_g REAL NOT NULL,
              carbs_g REAL NOT NULL,
              source TEXT NOT NULL,
              raw_ai_response TEXT
            );
            """
        )
        conn.commit()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

