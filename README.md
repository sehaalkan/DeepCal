# DeepCal

Minimalist, dark-mode odaklı, fotoğraf ile kalori/makro takibi (MVP).

## Proje Yapısı
- `frontend/`: Vite + Tailwind (Vanilla JS)
- `backend/`: FastAPI (AI wrapper + API)

## Geliştirme (Local)

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Varsayılan: `http://localhost:5173`

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Healthcheck: `http://localhost:8000/health`

## ENV
`.env.example` dosyasını kopyalayıp `.env` olarak oluşturun:

```bash
copy .env.example .env
```

