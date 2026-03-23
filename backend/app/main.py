import json

from datetime import date

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_conn, init_db, utc_now_iso
from .models import LogCreateRequest, MealEntry, NutritionEstimate, TodayStats


def _parse_cors_origins(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


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
            raise HTTPException(status_code=502, detail="AI boş yanıt döndürdü.")

        try:
            # SDK response_mime_type=application/json ile doğrudan JSON string döner
            return NutritionEstimate.model_validate_json(raw_text)
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"AI yanıtı beklenen şemaya uymadı: {e}",
            )
    except HTTPException:
        raise
    except Exception as e:
        # Burada tam hatayı loglayabilmek için sunucu loguna da yazıyoruz
        import logging

        logging.exception("Gemini analiz hatası")
        raise HTTPException(status_code=502, detail=f"AI analiz hatası: {e}") from e


@app.post("/log", response_model=MealEntry)
def create_log(req: LogCreateRequest):
    created_at = utc_now_iso()
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO meal_entries
            (created_at, food_name, portion, multiplier, calories_kcal, protein_g, fat_g, carbs_g, source, raw_ai_response)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ),
        )
        entry_id = int(cur.lastrowid)
        row = conn.execute("SELECT * FROM meal_entries WHERE id = ?", (entry_id,)).fetchone()
        conn.commit()

    return MealEntry.model_validate(dict(row))


@app.get("/log/today", response_model=list[MealEntry])
def list_today():
    today = date.today().isoformat()
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, food_name, portion, multiplier, calories_kcal, protein_g, fat_g, carbs_g, source
            FROM meal_entries
            WHERE substr(created_at, 1, 10) = ?
            ORDER BY id DESC
            """,
            (today,),
        ).fetchall()
    return [MealEntry.model_validate(dict(r)) for r in rows]


@app.get("/stats/today", response_model=TodayStats)
def stats_today():
    today = date.today().isoformat()
    with get_conn() as conn:
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
    return TodayStats.model_validate(dict(row))

