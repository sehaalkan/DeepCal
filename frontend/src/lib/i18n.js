const STORAGE_KEY = 'dc_lang_v1'

const DICT = {
  tr: {
    header: {
      menu: 'Menü',
      profile: 'Profil',
      profileMenu: 'Profil menüsü',
      drawer: 'Yan menü',
      contentModal: 'İçerik modalı',
      changeLanguage: 'Dil değiştir',
      close: 'Kapat',
      logout: 'Çıkış Yap',
      accountInfo: 'Hesap Bilgileri',
      privacy: 'Veri ve Gizlilik',
      helpSupport: 'Yardım & Destek',
    },
    nav: {
      dailyStats: 'Günlük İstatistikler',
      water: 'Su Takibi',
      history: 'Öğün Geçmişi',
      settings: 'Profil & Hedefler',
      info: 'Bilgi',
      notFound: 'Bölüm bulunamadı.',
    },
    home: {
      welcomeTitle: 'Hoşgeldin, Seha!',
      welcomeDate: '16 Mart 2026 Perşembe',
      heroTag: 'AI Destekli Analiz',
      heroTitle: 'Hemen Öğününü Çek & Analiz Et',
      heroDesc: 'Yemeğinin fotoğrafını çekerek veya yükleyerek besin değerlerini hemen gör.',
      upload: 'Fotoğraf Çek / Yükle',
      visionBrand: 'DeepCal Vision',
      visionLine1: 'tabaktaki öğünleri akıllıca algılar.',
      visionLine2: 'Kalori, protein, yağ ve karbonhidrat dağılımını anında gör.',
      todaySummary: 'Bugünün Özeti',
      lessMore: 'Less → More',
      weeklyActivity: 'Haftalık Aktivite',
      streakContinueTitle: 'Seri Devam Ediyor',
      streakContinueDesc: 'Son 2 gündür hedeflerini tutturuyorsun.',
      streakLabel: 'Seri',
      streakValue: '2 Gün',
      quickRegisterTitle: 'Hızlı Kayıt & Son Öğünler',
      quickRegisterDesc: 'Sık yediklerini tek dokunuşla ekle.',
      fast: {
        sucukluPizza: 'Sucuklu Pizza',
        greenApple: 'Yeşil Elma',
        filteredCoffee: 'Filtre Kahve',
      },
    },
    profile: {
      streakBadge: '2 Gün Seri',
      proMember: 'Pro Üye',
    },
    common: {
      empty: 'Şimdilik kayıt yok.',
    },
    validation: {
      noFile: 'Dosya bulunamadı.',
      unsupportedType: 'Desteklenmeyen dosya türü. (JPG/PNG/WEBP)',
      fileTooLarge: 'Dosya çok büyük. Maksimum {{max}} MB.',
    },
    api: {
      operationFailed: 'İşlem başarısız.',
      logFailed: 'Kayıt başarısız.',
      statsFailed: 'İstatistikler alınamadı.',
      diaryFailed: 'Günlük alınamadı.',
      serverUnreachable: 'Sunucuya bağlanılamadı. Lütfen backend sunucusunu kontrol edin.',
    },
    upload: {
      analyzing: 'Analiz ediliyor...',
    },
    ai: {
      analyzeError: 'AI analiz hatası',
      analyzeFailed: 'Analiz sırasında bir hata oluştu',
      analyzeSuccess: 'Başarıyla Analiz Edildi: {{name}}',
    },
    meals: {
      unknown: 'Bilinmeyen Öğün',
      makarna: 'Domatesli Makarna',
      tavukSalata: 'Izgara Tavuk Salatası',
      sucukluPizza: 'Sucuklu Pizza',
      greenApple: 'Yeşil Elma',
      filteredCoffee: 'Filtre Kahve',
    },
    toast: {
      mealAdded: '{{name}} eklendi (+{{kcal}} kcal)',
      waterAdded: '+{{ml}}ml eklendi',
      settingsSaved: 'Profil & Hedefler kaydedildi',
    },
    water: {
      today: 'Bugün',
      target: 'Hedef:',
      fullness: 'Doluluk:',
    },
    settings: {
      tabs: {
        profile: 'Vücut Profili',
        goal: 'Beslenme Hedefi',
      },
      labels: {
        height: 'Boy (cm)',
        weight: 'Kilo (kg)',
        age: 'Yaş',
        gender: 'Cinsiyet',
        dailyCalGoal: 'Günlük Kalori Hedefi',
      },
      gender: {
        woman: 'Kadın',
        man: 'Erkek',
      },
      quickGoal: {
        cut: 'Kilo Ver',
        keep: 'Kiloyu Koru',
        gain: 'Kilo Al',
      },
      save: 'Kaydet',
    },
    history: {
      empty: 'Şimdilik kayıt yok.',
      slot: {
        breakfast: 'Kahvaltı',
        lunch: 'Öğle',
        dinner: 'Akşam',
      },
    },
    stats: {
      rings: {
        protein: 'Protein',
        fat: 'Yağ',
        carbs: 'Karb',
      },
      todayTotalCalories: 'Bugün toplam kalorisi',
      targets: {
        protein: 'Hedef protein: {{value}}g',
        fat: 'Hedef yağ: {{value}}g',
        carbs: 'Hedef karb: {{value}}g',
      },
    },
    result: {
      detected: 'Tespit Edilen: {{name}}',
      calories: 'Kalori',
      protein: 'Protein',
      fat: 'Yağ',
      carbs: 'Karbonhidrat',
      addToDiary: 'Sonucu Günlüğüme Ekle',
    },
  },
  en: {
    header: {
      menu: 'Menu',
      profile: 'Profile',
      profileMenu: 'Profile menu',
      drawer: 'Side menu',
      contentModal: 'Content modal',
      changeLanguage: 'Change language',
      close: 'Close',
      logout: 'Log out',
      accountInfo: 'Account details',
      privacy: 'Data & privacy',
      helpSupport: 'Help & support',
    },
    nav: {
      dailyStats: 'Daily Statistics',
      water: 'Water Tracking',
      history: 'Meal History',
      settings: 'Profile & Goals',
      info: 'Info',
      notFound: 'Section not found.',
    },
    home: {
      welcomeTitle: 'Welcome, Seha!',
      welcomeDate: 'Thursday, March 16, 2026',
      heroTag: 'AI-Assisted Analysis',
      heroTitle: 'Snap & Analyze Your Meal',
      heroDesc: 'See nutrition values instantly by taking a photo or uploading one.',
      upload: 'Take Photo / Upload',
      visionBrand: 'DeepCal Vision',
      visionLine1: 'smartly detects meals on your plate.',
      visionLine2: 'Instantly view calories, protein, fat, and carb breakdown.',
      todaySummary: "Today's Summary",
      lessMore: 'Less → More',
      weeklyActivity: 'Weekly Activity',
      streakContinueTitle: 'Streak Continues',
      streakContinueDesc: 'You’ve been hitting your goals for the last 2 days.',
      streakLabel: 'Streak',
      streakValue: '2 Days',
      quickRegisterTitle: 'Quick Add & Recent Meals',
      quickRegisterDesc: 'Add your favorites in one tap.',
      fast: {
        sucukluPizza: 'Sausage Pizza',
        greenApple: 'Green Apple',
        filteredCoffee: 'Filtered Coffee',
      },
    },
    profile: {
      streakBadge: '2-Day Streak',
      proMember: 'Pro Member',
    },
    common: {
      empty: 'No records yet.',
    },
    validation: {
      noFile: 'File not found.',
      unsupportedType: 'Unsupported file type. (JPG/PNG/WEBP)',
      fileTooLarge: 'File is too large. Max {{max}} MB.',
    },
    api: {
      operationFailed: 'Operation failed.',
      logFailed: 'Log entry failed.',
      statsFailed: 'Could not fetch statistics.',
      diaryFailed: 'Could not fetch diary.',
      serverUnreachable: 'Could not connect to server. Please check backend service.',
    },
    upload: {
      analyzing: 'Analyzing...',
    },
    ai: {
      analyzeError: 'AI analysis error',
      analyzeFailed: 'An error occurred during analysis',
      analyzeSuccess: 'Analyzed successfully: {{name}}',
    },
    meals: {
      unknown: 'Unknown Meal',
      makarna: 'Tomato Pasta',
      tavukSalata: 'Grilled Chicken Salad',
      sucukluPizza: 'Sausage Pizza',
      greenApple: 'Green Apple',
      filteredCoffee: 'Filtered Coffee',
    },
    toast: {
      mealAdded: '{{name}} added (+{{kcal}} kcal)',
      waterAdded: '+{{ml}}ml added',
      settingsSaved: 'Profile & Goals saved',
    },
    water: {
      today: 'Today',
      target: 'Target:',
      fullness: 'Fill level:',
    },
    settings: {
      tabs: {
        profile: 'Body Profile',
        goal: 'Nutrition Goals',
      },
      labels: {
        height: 'Height (cm)',
        weight: 'Weight (kg)',
        age: 'Age',
        gender: 'Gender',
        dailyCalGoal: 'Daily Calorie Goal',
      },
      gender: {
        woman: 'Woman',
        man: 'Man',
      },
      quickGoal: {
        cut: 'Cut Weight',
        keep: 'Maintain Weight',
        gain: 'Gain Weight',
      },
      save: 'Save',
    },
    history: {
      empty: 'No records yet.',
      slot: {
        breakfast: 'Breakfast',
        lunch: 'Lunch',
        dinner: 'Dinner',
      },
    },
    stats: {
      rings: {
        protein: 'Protein',
        fat: 'Fat',
        carbs: 'Carbs',
      },
      todayTotalCalories: 'Total calories today',
      targets: {
        protein: 'Target protein: {{value}}g',
        fat: 'Target fat: {{value}}g',
        carbs: 'Target carbs: {{value}}g',
      },
    },
    result: {
      detected: 'Detected: {{name}}',
      calories: 'Calories',
      protein: 'Protein',
      fat: 'Fat',
      carbs: 'Carbohydrates',
      addToDiary: 'Add result to diary',
    },
  },
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined
  const parts = String(path).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]
    else return undefined
  }
  return cur
}

let currentLang = 'tr'

function resolveInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'tr') return saved
  } catch {
    // ignore
  }
  return 'tr'
}

currentLang = resolveInitialLang()

export function getLanguage() {
  return currentLang
}

export function setLanguage(lang) {
  if (lang !== 'tr' && lang !== 'en') return
  currentLang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // ignore
  }

  try {
    document.documentElement.lang = lang
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent('deepcal:langchange', { detail: { lang } }))
}

export function t(key, vars = {}) {
  const raw =
    getByPath(DICT[currentLang], key) ??
    getByPath(DICT.tr, key) ??
    key

  if (typeof raw !== 'string') return String(raw)

  return raw.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] === undefined ? '' : String(vars[name])))
}

export function applyI18n(root = document) {
  if (!root) return

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    if (!key) return
    el.textContent = t(key)
  })

  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html')
    if (!key) return
    el.innerHTML = t(key)
  })

  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label')
    if (!key) return
    el.setAttribute('aria-label', t(key))
  })
}

