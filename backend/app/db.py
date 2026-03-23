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
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              hashed_password TEXT NOT NULL,
              current_streak INTEGER,
              last_log_date TEXT
            );
            """
        )
        conn.commit()

        # Existing installations: ensure streak columns exist.
        col_names = {row["name"] for row in conn.execute("PRAGMA table_info(users);").fetchall()}
        if "current_streak" not in col_names:
            conn.execute("ALTER TABLE users ADD COLUMN current_streak INTEGER;")
            conn.commit()
        if "last_log_date" not in col_names:
            conn.execute("ALTER TABLE users ADD COLUMN last_log_date TEXT;")
            conn.commit()

        # Keep legacy rows consistent (avoid NULL streak).
        conn.execute("UPDATE users SET current_streak = 0 WHERE current_streak IS NULL;")
        conn.commit()

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
              raw_ai_response TEXT,
              user_id INTEGER
            );
            """
        )
        conn.commit()

        # Existing installations: ensure meal_entries.user_id column exists.
        col_names = {row["name"] for row in conn.execute("PRAGMA table_info(meal_entries);").fetchall()}
        if "user_id" not in col_names:
            conn.execute("ALTER TABLE meal_entries ADD COLUMN user_id INTEGER;")
            conn.commit()

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_meal_entries_user_id ON meal_entries(user_id);"
        )
        conn.commit()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

