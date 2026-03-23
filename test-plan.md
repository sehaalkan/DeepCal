# DeepCal — MVP Test Planı

## Amaç
Fotoğrafla analiz → sonuç kartı → porsiyon seçimi → günlüğe kaydet akışının, hata senaryoları dahil, uçtan uca doğrulanması.

## Önkoşullar
- Frontend çalışıyor: `npm run dev` (`frontend/`)
- Backend çalışıyor: `uvicorn app.main:app --reload --port 8000` (`backend/`)
- (Opsiyonel) Gemini: `.env` içinde `GEMINI_API_KEY` dolu

## Smoke Test (5 dk)
- [ ] **Backend**: `GET /health` → `{ ok: true }`
- [ ] **Frontend**: Ana ekran açılıyor, kamera CTA tıklanınca dosya seçici açılıyor
- [ ] **Sidebar**: Menü aç/kapa çalışıyor, Stats/Settings sayfaları açılıyor

## Akış Testleri
### 1) Analiz → Sonuç Kartı
- [ ] JPG/PNG/WEBP görsel seç → loading görünür → sonuç bottom-sheet açılır
- [ ] Bottom-sheet’te **yemek adı** ve **kcal/protein/yağ/karb** chip’leri görünür
- [ ] “Kapat” ve backdrop tıkla → sheet kapanır

### 2) Porsiyon Çarpanı
- [ ] Orta → Küçük → Büyük seç → chip değerleri anlık değişir
- [ ] Seçim tekli (aynı anda tek porsiyon aktif)

### 3) Günlüğe Kaydet
- [ ] “Günlüğe Kaydet” → başarılı mesaj → ana ekrana dönüş
- [ ] Sidebar → “Günlük İstatistikler” → toplamlar artmış + listede yeni öğün görünür

## Negatif / Hata Senaryoları
### 1) Dosya validasyonu (frontend)
- [ ] Desteklenmeyen tip (örn. PDF) seç → “Desteklenmeyen dosya türü” mesajı
- [ ] 8MB+ görsel seç → “Dosya çok büyük” mesajı

### 2) Gemini key yok (backend)
- [ ] `GEMINI_API_KEY` boşken analiz → 503 ve kullanıcıya anlamlı hata mesajı

### 3) İptal (frontend)
- [ ] Analiz sırasında “İptal” → istek iptal edilir, loading kapanır, “İşlem iptal edildi” görünür

## Responsive / UX
- [ ] Mobil genişlikte CTA merkezde, sheet ekrana düzgün oturuyor
- [ ] Buton disabled state’leri (Save) doğru çalışıyor

