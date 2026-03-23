# ✅ DeepCal — MVP Task Listesi (PRD v1.0)

Bu dosya `prd.md` içeriğine göre **MVP** geliştirme iş kırılımını (backlog) içerir.

## 0) Proje Kurulumu
- [ ] **Monorepo/klasör yapısı**: `frontend/` (Vite + Tailwind), `backend/` (FastAPI)
- [ ] **Ortak dokümantasyon**: `README.md` (kurulum, çalıştırma, env değişkenleri)
- [ ] **Ortam değişkenleri şablonu**: `.env.example` (Gemini anahtarı, DB URL vb.)

## 1) Frontend (Vite + Tailwind) — Minimal Dark UI
### 1.1 Ana ekran (Home)
- [ ] **Header**: sol `≡` hamburger, orta `DeepCal`, sağ profil/avatar ikonu
- [ ] **Hero/CTA**: merkezde büyük dairesel kamera butonu + yönlendirme metni
- [ ] **State’ler**: ilk açılış (empty), yükleme (loading), hata (error)

### 1.2 Fotoğraf ekleme akışı
- [ ] **Dosya seçimi**: kamera/galeri (web için `input type="file"`), kabul edilen formatlar ve max boyut
- [ ] **Upload UX**: progress/loader + iptal/yeniden dene davranışı

### 1.3 Sonuç kartı (Bottom Sheet / Modal)
- [ ] **Panel**: alttan açılan, yumuşak animasyonlu minimal bottom sheet
- [ ] **Sonuç gösterimi**: yemek adı + `kcal | protein | yağ | karb` chip/hap formatı
- [ ] **Porsiyon seçimi**: `Küçük / Orta / Büyük` tek seçim (segmented control gibi)
- [ ] **Porsiyon çarpanı**: seçime göre makroların anlık güncellenmesi
- [ ] **Aksiyon**: `Günlüğe Kaydet` butonu

### 1.4 Navigasyon (Sidebar)
- [ ] **Sidebar**: “Günlük İstatistikler”, “Ayarlar” linkleri
- [ ] **Sayfalar (MVP iskelet)**: İstatistikler ve Ayarlar ekranlarının temel düzeni

## 2) Backend (FastAPI) — AI Wrapper + API
### 2.1 Temel servis
- [ ] **FastAPI iskeleti**: app init, router yapısı, healthcheck
- [ ] **CORS**: frontend origin’leri için
- [ ] **Config/ENV**: güvenli env okuma (Gemini key, DB url)

### 2.2 Gemini Vision AI entegrasyonu
- [ ] **`/analyze`**: görsel upload al, Gemini Vision’a gönder, **yapılandırılmış JSON** döndür
- [ ] **Prompt/çıktı sözleşmesi**: alanlar: `food_name`, `calories_kcal`, `protein_g`, `fat_g`, `carbs_g` (+ opsiyonel güven skoru)
- [ ] **Doğrulama/normalizasyon**: şema doğrulama, sayı parse, eksik alanlar, güvenli fallback
- [ ] **Hata yönetimi**: model hatası, timeout, invalid image → kullanıcıya anlamlı mesaj

### 2.3 Günlük (Log) sistemi + DB
- [ ] **DB seçimi (MVP)**: SQLite ile başla, PostgreSQL’e geçişe uygun yapı
- [ ] **Tablo**: `meal_entries` (tarih/saat, food_name, macros, portion, source, raw_ai_response opsiyonel)
- [ ] **`/log`**: öğün kaydı oluştur (frontend’den gelen seçili porsiyon + hesaplanmış makrolar)
- [ ] **`/log/today`**: bugünün öğünlerini listele
- [ ] **`/stats/today`**: bugünün toplam kcal ve makro toplamları

## 3) Frontend ↔ Backend Entegrasyonu
- [ ] **Analyze çağrısı**: görseli backend’e gönder, sonucu bottom sheet’te göster
- [ ] **Porsiyon çarpanı**: UI’da (client) sadece çarpma/toplama; ağır iş backend’de
- [ ] **Log kaydı**: `Günlüğe Kaydet` → `/log` çağrısı → başarılıysa home’a dönüş

## 4) MVP Test Planı
- [ ] **Örnek veri seti**: farklı ışık/angle ve farklı yemek fotoğrafları
- [ ] **Senaryolar**: başarılı analiz, düşük güven, yanlış/eksik JSON, upload hatası, timeout
- [ ] **UI kontrolleri**: responsive, modal davranışı, loading/disabled state, erişilebilirlik (minimum)

## 5) Kabul Kriterleri (MVP)
- [ ] Kullanıcı fotoğraf yükleyip 1 akışta: **analiz → porsiyon seçimi → günlüğe kaydet** yapabiliyor.
- [ ] Analiz sonucu en az şu alanları veriyor: **yemek adı, kcal, protein, yağ, karb**.
- [ ] Porsiyon seçimi makroları anlık güncelliyor.
- [ ] Kaydedilen öğünler bugünün listesinde ve toplam istatistikte görünüyor.

