import json
import re
import sqlite3
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings
from .db import get_conn, init_db, utc_now_iso
from .models import (
    LogCreateRequest,
    MealEntry,
    NutritionEstimate,
    TodayStats,
    TokenResponse,
    UserMeResponse,
    UserLoginRequest,
    UserRegisterRequest,
)


def _parse_cors_origins(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _clean_ai_json_text(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2:
        return None
    if parts[0].lower() != "bearer":
        return None
    return parts[1]


def _create_access_token(user_id: int) -> str:
    expires_at = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_exp_minutes)
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_user_id(token: str) -> int | None:
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except JWTError:
        return None
    except Exception:
        return None


def get_optional_user_id(authorization: str | None = Header(default=None)) -> int | None:
    token = _extract_bearer_token(authorization)
    if not token:
        return None
    return _decode_user_id(token)


def get_required_user_id(authorization: str | None = Header(default=None)) -> int:
    user_id = get_optional_user_id(authorization)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user_id


app = FastAPI(title="DeepCal API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    init_db()


@app.get("/health")
def health():
    return {"ok": True, "env": settings.app_env}


@app.post("/register", response_model=TokenResponse)
def register(req: UserRegisterRequest):
    email = req.email.strip().lower()
    hashed_password = pwd_context.hash(req.password)

    with get_conn() as conn:
        try:
            cur = conn.execute(
                """
                INSERT INTO users (name, email, hashed_password)
                VALUES (?, ?, ?)
                """,
                (req.name, email, hashed_password),
            )
            conn.commit()
            user_id = int(cur.lastrowid)
        except sqlite3.IntegrityError as e:
            raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı.") from e

    return TokenResponse(access_token=_create_access_token(user_id), token_type="bearer")


@app.post("/login", response_model=TokenResponse)
def login(req: UserLoginRequest):
    email = req.email.strip().lower()

    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, hashed_password FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if not row or not pwd_context.verify(req.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Geçersiz email veya şifre.")

    user_id = int(row["id"])
    return TokenResponse(access_token=_create_access_token(user_id), token_type="bearer")


@app.get("/logs", response_model=list[MealEntry])
def list_logs(user_id: int = Depends(get_required_user_id)):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, food_name, portion, multiplier,
                   calories_kcal, protein_g, fat_g, carbs_g, source
            FROM meal_entries
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()

    return [MealEntry.model_validate(dict(r)) for r in rows]


@app.get("/me", response_model=UserMeResponse)
def me(user_id: int = Depends(get_required_user_id)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, name, email, current_streak, last_log_date FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return UserMeResponse(
        id=int(row["id"]),
        name=row["name"],
        email=row["email"],
        current_streak=int(row["current_streak"] or 0),
        last_log_date=row["last_log_date"],
    )


@app.post("/analyze", response_model=NutritionEstimate)
async def analyze(image: UploadFile):
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY ayarlı değil. `.env` dosyanızı kontrol edin.",
        )

    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Geçersiz dosya türü. (image/*)")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Boş dosya.")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Dosya çok büyük. (maks 8MB)")

    try:
        from google import genai
        from google.genai import errors as genai_errors
        from google.genai import types
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Gemini SDK yüklenemedi.") from e

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = (
        "Bu yemek fotoğrafını analiz et ve SADECE JSON döndür.\n"
        "Şema alanları:\n"
        "- food_name: string\n"
        "- calories_kcal: number\n"
        "- protein_g: number\n"
        "- fat_g: number\n"
        "- carbs_g: number\n"
        "- confidence: number (0-1) veya null\n"
        "Kurallar:\n"
        "- Sayılar negatif olmasın.\n"
        "- Mümkünse Türkçe yemek adı kullan.\n"
        "- Kesin emin değilsen confidence düşür.\n"
    )

    try:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=NutritionEstimate,
        )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
              types.Part.from_bytes(data=data, mime_type=image.content_type),
              types.Part.from_text(text= prompt),
            ],
            config=config,
        )

        raw_text = (response.text or "").strip()
        if not raw_text:
            raise HTTPException(
                status_code=502,
                detail="Görsel analiz edilemedi, lütfen daha net bir fotoğrafla tekrar deneyin.",
            )

        try:
            # Model bazen yanıtı ```json ... ``` bloğunda döndürebilir.
            cleaned_text = _clean_ai_json_text(raw_text)
            parsed = json.loads(cleaned_text)
            return NutritionEstimate.model_validate(parsed)
        except Exception as e:
            import logging

            print(f"AI Analiz Hatası (parse): {str(e)}")
            logging.exception("AI yanıt şema hatası")
            raise HTTPException(
                status_code=502,
                detail="Görsel analiz edilemedi, lütfen daha net bir fotoğrafla tekrar deneyin.",
            )
    except HTTPException:
        raise
    except genai_errors.ClientError as e:
        # e.g. 403 PERMISSION_DENIED for invalid/leaked API key
        print(f"AI Analiz Hatası (client): {str(e)}")
        import logging

        logging.exception("Gemini client hatası")
        raise HTTPException(
            status_code=502,
            detail="AI servisine erişilemiyor. API anahtarınızı (GEMINI_API_KEY) yenileyip tekrar deneyin.",
        ) from e
    except Exception as e:
        # Burada tam hatayı loglayabilmek için sunucu loguna da yazıyoruz
        import logging

        print(f"AI Analiz Hatası: {str(e)}")
        logging.exception("Gemini analiz hatası")
        raise HTTPException(
            status_code=502,
            detail="Görsel analiz edilemedi, lütfen daha net bir fotoğrafla tekrar deneyin.",
        ) from e


@app.post("/log", response_model=MealEntry)
def create_log(req: LogCreateRequest, user_id: int | None = Depends(get_optional_user_id)):
    created_at = utc_now_iso()
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO meal_entries
            (created_at, food_name, portion, multiplier, calories_kcal, protein_g, fat_g, carbs_g, source, raw_ai_response, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                req.food_name,
                req.portion,
                req.multiplier,
                req.calories_kcal,
                req.protein_g,
                req.fat_g,
                req.carbs_g,
                req.source,
                req.raw_ai_response,
                user_id,
            ),
        )
        entry_id = int(cur.lastrowid)
        row = conn.execute(
            """
            SELECT id, created_at, food_name, portion, multiplier,
                   calories_kcal, protein_g, fat_g, carbs_g, source
            FROM meal_entries
            WHERE id = ?
            """,
            (entry_id,),
        ).fetchone()

        # Streak update (only for authenticated users).
        if user_id is not None:
            today = date.today()
            today_str = today.isoformat()

            user_row = conn.execute(
                "SELECT current_streak, last_log_date FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()

            current_streak = int((user_row["current_streak"] or 0) if user_row else 0)
            last_log_date_str = (user_row["last_log_date"] if user_row else None) or None

            last_date = None
            if last_log_date_str:
                try:
                    last_date = date.fromisoformat(last_log_date_str)
                except Exception:
                    last_date = None

            if not last_date:
                new_streak = 1
            else:
                delta_days = (today - last_date).days
                if delta_days == 0:
                    new_streak = max(1, current_streak)  # keep streak on same day
                elif delta_days == 1:
                    new_streak = current_streak + 1
                else:
                    new_streak = 1

            conn.execute(
                "UPDATE users SET current_streak = ?, last_log_date = ? WHERE id = ?",
                (new_streak, today_str, user_id),
            )

        conn.commit()

    return MealEntry.model_validate(dict(row))


@app.get("/log/today", response_model=list[MealEntry])
def list_today(user_id: int | None = Depends(get_optional_user_id)):
    today = date.today().isoformat()
    with get_conn() as conn:
        if user_id is None:
            rows = conn.execute(
                """
                SELECT id, created_at, food_name, portion, multiplier, calories_kcal, protein_g,
                       fat_g, carbs_g, source
                FROM meal_entries
                WHERE substr(created_at, 1, 10) = ?
                ORDER BY id DESC
                """,
                (today,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, created_at, food_name, portion, multiplier, calories_kcal, protein_g,
                       fat_g, carbs_g, source
                FROM meal_entries
                WHERE substr(created_at, 1, 10) = ?
                  AND user_id = ?
                ORDER BY id DESC
                """,
                (today, user_id),
            ).fetchall()
    return [MealEntry.model_validate(dict(r)) for r in rows]


@app.get("/stats/today", response_model=TodayStats)
def stats_today(user_id: int | None = Depends(get_optional_user_id)):
    today = date.today().isoformat()
    with get_conn() as conn:
        if user_id is None:
            row = conn.execute(
                """
                SELECT
                  COALESCE(SUM(calories_kcal), 0) AS calories_kcal,
                  COALESCE(SUM(protein_g), 0) AS protein_g,
                  COALESCE(SUM(fat_g), 0) AS fat_g,
                  COALESCE(SUM(carbs_g), 0) AS carbs_g
                FROM meal_entries
                WHERE substr(created_at, 1, 10) = ?
                """,
                (today,),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT
                  COALESCE(SUM(calories_kcal), 0) AS calories_kcal,
                  COALESCE(SUM(protein_g), 0) AS protein_g,
                  COALESCE(SUM(fat_g), 0) AS fat_g,
                  COALESCE(SUM(carbs_g), 0) AS carbs_g
                FROM meal_entries
                WHERE substr(created_at, 1, 10) = ?
                  AND user_id = ?
                """,
                (today, user_id),
            ).fetchone()
    return TodayStats.model_validate(dict(row))

