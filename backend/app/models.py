from pydantic import BaseModel, Field


class NutritionEstimate(BaseModel):
    food_name: str = Field(description="Yemek adı (Türkçe mümkünse).")
    calories_kcal: float = Field(ge=0, description="Kalori (kcal).")
    protein_g: float = Field(ge=0, description="Protein (gram).")
    fat_g: float = Field(ge=0, description="Yağ (gram).")
    carbs_g: float = Field(ge=0, description="Karbonhidrat (gram).")
    confidence: float | None = Field(
        default=None, ge=0, le=1, description="Opsiyonel güven skoru (0-1)."
    )


class LogCreateRequest(BaseModel):
    food_name: str
    portion: str = Field(description="kucuk|orta|buyuk gibi bir etiket")
    multiplier: float = Field(gt=0)
    calories_kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    source: str = Field(default="ai")
    raw_ai_response: str | None = None


class MealEntry(BaseModel):
    id: int
    created_at: str
    food_name: str
    portion: str
    multiplier: float
    calories_kcal: float
    protein_g: float
    fat_g: float
    carbs_g: float
    source: str


class TodayStats(BaseModel):
    calories_kcal: float
    protein_g: float
    fat_g: float
    carbs_g: float


class UserRegisterRequest(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=8)


class UserLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: int
    name: str
    email: str
    current_streak: int = 0
    last_log_date: str | None = None

