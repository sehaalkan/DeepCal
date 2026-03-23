# 📄 Ürün Gereksinim Dokümanı (PRD): DeepCal

**Sürüm:** 1.0  
**Durum:** Taslak / Geliştirme Öncesi  

## 1. Ürün Vizyonu ve Özeti
**DeepCal**, kullanıcıların yediklerinin kalori ve makro besin değerlerini manuel olarak girmek yerine, sadece bir fotoğraf çekerek yapay zeka yardımıyla anında öğrenebildikleri, minimalist ve karanlık tema (dark mode) odaklı bir mobil/web uygulamasıdır. Temel amaç, sürtünmesiz (frictionless) bir kullanıcı deneyimi ile kalori takibini saniyeler içine indirmektir.

---

## 2. Tasarım ve Kullanıcı Arayüzü (UI) Prensipleri
Uygulama tamamen "Karanlık Tema" (Dark Mode) üzerine inşa edilecek ve gereksiz hiçbir görsel öge barındırmayacaktır. 

### Üst Bilgi Çubuğu (Header)
* **Sol Üst:** Gezinme için sade bir Hamburger Menü ikonu (`≡`).
* **Merkez:** İnce, zarif bir tipografi ile `DeepCal` başlığı.
* **Sağ Üst:** Minimalist bir Kullanıcı Profili ikonu veya avatarı.

### Ana Odak Noktası (Hero Section)
* Ekranın tam merkezinde, kullanıcıyı eyleme çağıran büyük, dairesel bir **Kamera Butonu**.
* Butonun hemen üzerinde veya içinde yönlendirici metin: *"Öğününüzü buraya ekleyin: [Kamera İkonu]"*

### Sonuç Kartı (Bottom Sheet / Modal)
* Fotoğraf yüklendikten sonra ekranın altından yukarı doğru yumuşak bir animasyonla açılan minimal bir panel.
* Yüksek güvenilirlikli AI tespiti sonucu (Örn: **Karnıyarık**).
* Hap bilgi şeklinde makro değerleri (Örn: `320 kcal | 15g Protein`).
* **Porsiyon Seçimi:** `Küçük`, `Orta`, `Büyük` şeklinde, tek tıkla seçilebilecek yan yana üç minimal buton.
* **Aksiyon:** Süreci tamamlayan belirgin bir `Günlüğe Kaydet` butonu.

---

## 3. Temel Kullanıcı Senaryosu (User Flow)
Bir kullanıcının uygulamaya girip çıkması şu adımlardan oluşur:

1. Kullanıcı DeepCal uygulamasını açar ve doğrudan ana ekrandaki dev kamera butonunu görür.
2. Butona tıklar; kamerası açılır (veya galeriden seçme opsiyonu sunulur) ve yemeğin fotoğrafını çeker.
3. Uygulama kısa bir yükleme animasyonu (loading) gösterirken arka planda fotoğrafı yapay zekaya gönderir.
4. Sonuç kartı açılır. Kullanıcı yemeği ve makroları görür.
5. Kullanıcı yediği porsiyona göre (Küçük/Orta/Büyük) seçimini yapar (makrolar bu seçime göre anında ekranda güncellenir).
6. `Günlüğe Kaydet` butonuna basar ve ana ekrana geri döner. İşlem tamamlanmıştır.

---

## 4. Fonksiyonel Gereksinimler (MVP - Minimum Uygulanabilir Ürün)
Uygulamanın ilk versiyonunda canlıya çıkması için "olmazsa olmaz" özellikler:

| Özellik | Açıklama |
| :--- | :--- |
| **Görüntü İşleme (Vision AI)** | Yüklenen fotoğrafın bir Vision modeline iletilip yapılandırılmış veri (Yemek Adı, Kalori, Protein, Yağ, Karb) olarak dönmesi. |
| **Porsiyon Çarpanı** | AI'dan gelen standart değerin, kullanıcının "Küçük" veya "Büyük" seçimine göre anında arayüzde yeniden hesaplanması. |
| **Günlük (Log) Sistemi** | Kaydedilen öğünlerin o güne ait bir veritabanı tablosuna yazılması. |
| **Yan Menü (Sidebar)** | "Günlük İstatistikler" ve "Ayarlar" sayfalarına yönlendiren temel navigasyon. |

---

## 5. Önerilen Teknoloji Yığını (Tech Stack)
* **Frontend (Arayüz):** HTML5/CSS temelleri üzerine **Vite** ve **Tailwind CSS** (Minimalist, modern ve hızlı bir arayüz için).
* **Backend (Sunucu/API):** **FastAPI** (Yapay zeka servisleriyle haberleşecek AI Wrapper mantığını hızlıca kurmak için).
* **Yapay Zeka (LLM):** Görsel analiz ve JSON çıktısı için Google Gemini Vision API.
* **Veritabanı:** PostgreSQL veya hızlı bir başlangıç için SQLite/Firebase.