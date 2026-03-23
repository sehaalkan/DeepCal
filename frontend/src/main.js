import './style.css'
import { createLogEntry, getTodayLog, getTodayStats } from './lib/api.js'
import { qs, on } from './lib/dom.js'
import { validateImageFile } from './lib/file.js'
import { applyI18n, getLanguage, setLanguage, t } from './lib/i18n.js'
import { createIcons, icons } from 'lucide'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const $app = document.querySelector('#app')

const RECENTS_KEY = 'dc_recent_meals_v1'
const MAX_RECENTS = 3

const QUICK_PLACEHOLDERS = {
  salata:
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  filtreKahve:
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
}

const PORTIONS = [
  { key: 'kucuk', label: 'Küçük', multiplier: 0.75 },
  { key: 'orta', label: 'Orta', multiplier: 1.0 },
  { key: 'buyuk', label: 'Büyük', multiplier: 1.25 },
]

const GOALS = {
  calories_kcal: 2000,
  protein_g: 120,
  fat_g: 70,
  carbs_g: 250,
}

const mealScenarios = {
  makarna: {
    nameKey: 'meals.makarna',
    calories_kcal: 480,
    protein_g: 14,
    fat_g: 18,
    carbs_g: 65,
  },
  tavukSalata: {
    nameKey: 'meals.tavukSalata',
    calories_kcal: 310,
    protein_g: 28,
    fat_g: 16,
    carbs_g: 14,
  },
  sucukluPizza: {
    nameKey: 'meals.sucukluPizza',
    calories_kcal: 520,
    protein_g: 22,
    fat_g: 26,
    carbs_g: 52,
  },
}

function fmtNumber(value, digits = 0) {
  const n = Number(value || 0)
  const d = digits
  return n.toLocaleString('tr-TR', { maximumFractionDigits: d, minimumFractionDigits: d })
}

function clamp01(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

function initStaticDashboard() {
  const uploadBtn = document.querySelector('#deepcal-upload-btn')
  if (!uploadBtn) return // Static dashboard is not present

  // Static HTML üzerindeki `data-i18n` etiketlerini anında güncelle.
  applyI18n()

  let activeNavKey = null
  let activeResultMeal = null
  const langToggleBtn = document.getElementById('deepcal-lang-toggle')

  const fileInput =
    document.querySelector('#deepcal-upload-input') ||
    (() => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.id = 'deepcal-upload-input'
      input.className = 'hidden'
      document.body.appendChild(input)
      return input
    })()

  const fastMealButtons = Array.from(document.querySelectorAll('[data-fast-kcal]'))

  // Static dashboard için sağ üst profil popover kapanma (modal açılırken çakışmasın)
  const staticProfilePopover = qs('#deepcal-profile-popover')
  const staticProfileBackdrop = qs('#deepcal-profile-backdrop')
  const staticProfileBtn = qs('#deepcal-profile-btn')

  function closeStaticProfilePopover() {
    try {
      if (staticProfilePopover) {
        staticProfilePopover.classList.add('hidden')
        staticProfilePopover.classList.remove('deepcal-profile-pop')
      }
      if (staticProfileBackdrop) {
        staticProfileBackdrop.classList.add('opacity-0', 'pointer-events-none')
        staticProfileBackdrop.classList.remove('opacity-100', 'pointer-events-auto')
      }
      staticProfileBtn?.setAttribute?.('aria-expanded', 'false')
    } catch {
      // ignore
    }
  }

  const DAILY_KCAL_KEY_PREFIX = 'dc_daily_kcal_v1_'
  const DAILY_WATER_ML_KEY_PREFIX = 'dc_daily_water_ml_v1_'
  const DAILY_PROTEIN_G_KEY_PREFIX = 'dc_daily_protein_g_v1_'
  const DAILY_FAT_G_KEY_PREFIX = 'dc_daily_fat_g_v1_'
  const DAILY_CARBS_G_KEY_PREFIX = 'dc_daily_carbs_g_v1_'
  const DAILY_HISTORY_KEY_PREFIX = 'dc_daily_history_v1_'
  const PROFILE_KEY = 'dc_profile_v1'

  const defaultProfile = {
    heightCm: 170,
    weightKg: 70,
    age: 25,
    gender: 'Kadın',
    dailyCalGoal: 2000,
  }

  function getLocalDateKey(d = new Date()) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  function getDailyKey(prefix, dateKey) {
    return `${prefix}${dateKey}`
  }

  function readNumber(key, fallback = 0) {
    const raw = localStorage.getItem(key)
    if (raw === null || raw === undefined) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return fallback
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore
    }
  }

  function showToast(message) {
    const existing = document.querySelector('#deepcal-toast')
    if (existing) existing.remove()
    const el = document.createElement('div')
    el.id = 'deepcal-toast'
    el.className =
      'fixed inset-x-0 bottom-6 z-[140] flex justify-center px-6 pointer-events-none'
    el.innerHTML = `
      <div class="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-emerald-200/40">
        <span class="h-1.5 w-1.5 rounded-full bg-white/90"></span>
        ${message}
      </div>
    `
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 2200)
  }

  function getPortionMultiplier(portionLabel) {
    if (portionLabel === 'Küçük') return 0.75
    if (portionLabel === 'Büyük') return 1.25
    return 1.0 // Orta
  }

  function computeMealForPortion(baseScenario, portionLabel) {
    const m = getPortionMultiplier(portionLabel)
    const mealName = baseScenario?.nameKey ? t(baseScenario.nameKey) : baseScenario?.name
    return {
      name: mealName || t('meals.unknown'),
      calories_kcal: Math.round(Number(baseScenario.calories_kcal || 0) * m),
      protein_g: Math.round(Number(baseScenario.protein_g || 0) * m),
      fat_g: Math.round(Number(baseScenario.fat_g || 0) * m),
      carbs_g: Math.round(Number(baseScenario.carbs_g || 0) * m),
    }
  }

  const quickMealScenarios = {
    sucuklu_pizza: {
      ...mealScenarios.sucukluPizza,
    },
    green_apple: {
      nameKey: 'meals.greenApple',
      calories_kcal: 95,
      protein_g: 0.5,
      fat_g: 0.3,
      carbs_g: 25,
    },
    filtered_coffee: {
      nameKey: 'meals.filteredCoffee',
      calories_kcal: 15,
      protein_g: 0.4,
      fat_g: 0.2,
      carbs_g: 1.7,
    },
  }

  function getTodayDateKey() {
    return getLocalDateKey(new Date())
  }

  function getDailyMacros() {
    const dateKey = getTodayDateKey()
    return {
      kcal: readNumber(getDailyKey(DAILY_KCAL_KEY_PREFIX, dateKey), 0),
      protein_g: readNumber(getDailyKey(DAILY_PROTEIN_G_KEY_PREFIX, dateKey), 0),
      fat_g: readNumber(getDailyKey(DAILY_FAT_G_KEY_PREFIX, dateKey), 0),
      carbs_g: readNumber(getDailyKey(DAILY_CARBS_G_KEY_PREFIX, dateKey), 0),
      history: readJson(getDailyKey(DAILY_HISTORY_KEY_PREFIX, dateKey), []),
      waterMl: readNumber(getDailyKey(DAILY_WATER_ML_KEY_PREFIX, dateKey), 0),
    }
  }

  function addMealToDiary(meal) {
    if (!meal) return
    const dateKey = getTodayDateKey()

    const kcalKey = getDailyKey(DAILY_KCAL_KEY_PREFIX, dateKey)
    const proteinKey = getDailyKey(DAILY_PROTEIN_G_KEY_PREFIX, dateKey)
    const fatKey = getDailyKey(DAILY_FAT_G_KEY_PREFIX, dateKey)
    const carbsKey = getDailyKey(DAILY_CARBS_G_KEY_PREFIX, dateKey)
    const historyKey = getDailyKey(DAILY_HISTORY_KEY_PREFIX, dateKey)

    const prevKcal = readNumber(kcalKey, 0)
    const prevP = readNumber(proteinKey, 0)
    const prevF = readNumber(fatKey, 0)
    const prevC = readNumber(carbsKey, 0)

    localStorage.setItem(kcalKey, String(prevKcal + Number(meal.calories_kcal || 0)))
    localStorage.setItem(proteinKey, String(prevP + Number(meal.protein_g || 0)))
    localStorage.setItem(fatKey, String(prevF + Number(meal.fat_g || 0)))
    localStorage.setItem(carbsKey, String(prevC + Number(meal.carbs_g || 0)))

    const now = new Date()
    const hour = now.getHours()
    const slot = hour < 11 ? 'Kahvaltı' : hour < 17 ? 'Öğle' : 'Akşam'
    const entry = {
      ts: now.getTime(),
      slot,
      name: meal.name,
      calories_kcal: Number(meal.calories_kcal || 0),
    }

    const history = readJson(historyKey, [])
    history.push(entry)
    history.sort((a, b) => a.ts - b.ts)
    writeJson(historyKey, history)
  }

  function openModal(title, bodyHtml, mount) {
    // Sağ üst profil popover açıkken modal açılınca üst üste binmesin.
    closeStaticProfilePopover()

    const navModalOverlay = qs('#deepcal-nav-modal-overlay')
    const navModal = qs('#deepcal-nav-modal')
    const navModalCard = qs('#deepcal-nav-modal-card')
    const navModalTitle = qs('#deepcal-nav-modal-title')
    const navModalBody = qs('#deepcal-nav-modal-body')

    if (!navModalOverlay || !navModal || !navModalTitle || !navModalBody || !navModalCard) return

    navModalTitle.textContent = title || ''
    navModalBody.innerHTML = bodyHtml || ''

    navModalOverlay.classList.remove('hidden')
    navModal.classList.remove('hidden')
    navModalCard.classList.remove('deepcal-modal-pop')
    // Reflow to restart animation
    void navModalCard.offsetWidth
    navModalCard.classList.add('deepcal-modal-pop')

    if (typeof mount === 'function') mount()
  }

  function openResultModal(meal) {
    activeResultMeal = meal
    activeNavKey = null
    const proteinPct = Math.round(clamp01(meal.protein_g / (GOALS.protein_g || 1)) * 100)
    const fatPct = Math.round(clamp01(meal.fat_g / (GOALS.fat_g || 1)) * 100)
    const carbPct = Math.round(clamp01(meal.carbs_g / (GOALS.carbs_g || 1)) * 100)

    openModal(
      t('result.detected', { name: meal.name }),
      `
        <div class="mt-2 text-center">
          <div class="text-sm font-semibold text-slate-500">${t('result.calories')}</div>
          <div class="mt-2 text-4xl font-extrabold text-slate-900">
            ${fmtNumber(meal.calories_kcal, 0)} <span class="text-lg font-semibold text-slate-500">kcal</span>
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-green-50 text-green-600 ring-1 ring-green-100">🍃</span>
                ${t('result.protein')}
              </div>
              <div class="text-sm font-semibold text-slate-800">${fmtNumber(meal.protein_g, 0)}g</div>
            </div>
            <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-green-500" style="width: ${proteinPct}%"></div>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">🔥</span>
                ${t('result.fat')}
              </div>
              <div class="text-sm font-semibold text-slate-800">${fmtNumber(meal.fat_g, 0)}g</div>
            </div>
            <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-orange-500" style="width: ${fatPct}%"></div>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">💧</span>
                ${t('result.carbs')}
              </div>
              <div class="text-sm font-semibold text-slate-800">${fmtNumber(meal.carbs_g, 0)}g</div>
            </div>
            <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-blue-500" style="width: ${carbPct}%"></div>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <button id="deepcal-result-add-btn" type="button" class="w-full rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(124,58,237,0.35)] transition hover:from-purple-700 hover:to-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
            ${t('result.addToDiary')}
          </button>
        </div>
      `,
      () => {
        const addBtn = qs('#deepcal-result-add-btn')
        on(addBtn, 'click', (e) => {
          e?.preventDefault?.()
          addMealToDiary(meal)
          showToast(t('toast.mealAdded', { name: meal.name, kcal: fmtNumber(meal.calories_kcal, 0) }))
          closeNavModal()
        })
      }
    )
  }

  function closeNavModal() {
    activeNavKey = null
    activeResultMeal = null
    const navModalOverlay = qs('#deepcal-nav-modal-overlay')
    const navModal = qs('#deepcal-nav-modal')
    navModalOverlay?.classList?.add?.('hidden')
    navModal?.classList?.add?.('hidden')
  }

  function setAnalyzeButtonLoading(loading) {
    if (loading) {
      uploadBtn.setAttribute('disabled', 'true')
      uploadBtn.classList.add('opacity-90')
    } else {
      uploadBtn.removeAttribute('disabled')
      uploadBtn.classList.remove('opacity-90')
    }

    const labelSpan = uploadBtn.querySelectorAll('span')
    const textNode = labelSpan.length ? labelSpan[labelSpan.length - 1] : null

    const iconSvg = uploadBtn.querySelector('svg')
    const spinner = uploadBtn.querySelector('#deepcal-upload-spinner')

    if (loading) {
      if (textNode) textNode.textContent = t('upload.analyzing')
      if (iconSvg) iconSvg.classList.add('hidden')
      if (!spinner) {
        const s = document.createElement('div')
        s.id = 'deepcal-upload-spinner'
        s.className = 'ml-2 h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white'
        uploadBtn.appendChild(s)
      } else {
        spinner.classList.remove('hidden')
      }
    } else {
      if (textNode) textNode.textContent = t('home.upload')
      if (iconSvg) iconSvg.classList.remove('hidden')
      if (spinner) spinner.classList.add('hidden')
    }
  }

  let isAnalyzing = false

  if (langToggleBtn) {
    on(langToggleBtn, 'click', (e) => {
      e?.preventDefault?.()
      const next = getLanguage() === 'tr' ? 'en' : 'tr'
      setLanguage(next)
      applyI18n()

      // Upload butonunun metnini analiz durumuna göre güncelle
      setAnalyzeButtonLoading(isAnalyzing)

      // Açık modal varsa, yeniden çizerek tüm metinleri anlık çevir
      const overlay = qs('#deepcal-nav-modal-overlay')
      const isOpen = overlay && !overlay.classList.contains('hidden')
      if (isOpen) {
        if (activeResultMeal) openResultModal(activeResultMeal)
        else if (activeNavKey) openNavModal(activeNavKey)
      }
    })
  }

  on(uploadBtn, 'click', () => {
    fileInput.click()
  })

  async function callAnalyzeApi(file) {
    const form = new FormData()
    form.append('image', file)

    const res = await fetch('http://127.0.0.1:8000/analyze', {
      method: 'POST',
      body: form,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || t('ai.analyzeError'))
    }

    return res.json()
  }

  on(fileInput, 'change', async () => {
    if (isAnalyzing) return
    const file = fileInput.files?.[0]
    if (!file) return

    const validation = validateImageFile(file, { maxBytes: MAX_IMAGE_BYTES })
    if (!validation.ok) {
      showToast(validation.message)
      fileInput.value = ''
      return
    }

    isAnalyzing = true
    setAnalyzeButtonLoading(true)

    try {
      const ai = await callAnalyzeApi(file)

      const meal = {
        name: ai.food_name || t('meals.unknown'),
        calories_kcal: ai.calories_kcal ?? 0,
        protein_g: ai.protein_g ?? 0,
        fat_g: ai.fat_g ?? 0,
        carbs_g: ai.carbs_g ?? 0,
      }

      // Günlük istatistiklere gerçekten yaz
      addMealToDiary(meal)

      isAnalyzing = false
      setAnalyzeButtonLoading(false)

      openResultModal(meal)
      showToast(t('ai.analyzeSuccess', { name: meal.name }))
      fileInput.value = ''
    } catch (err) {
      console.error('Analiz Hatası Detayı:', err)
      isAnalyzing = false
      setAnalyzeButtonLoading(false)
      showToast(t('ai.analyzeFailed'))
      fileInput.value = ''
    }
  })

  fastMealButtons.forEach((btn) => {
    on(btn, 'click', () => {
      const id = btn.getAttribute('data-fast-id') || ''
      const scenario = quickMealScenarios[id]

      if (!scenario) {
        // Fallback: sadece kcal ile ekle
        const kcal = Number(btn.getAttribute('data-fast-kcal') || 0)
        const name = t('meals.unknown')
        addMealToDiary({
          name,
          calories_kcal: kcal,
          protein_g: 0,
          fat_g: 0,
          carbs_g: 0,
        })
        showToast(t('toast.mealAdded', { name, kcal: fmtNumber(kcal, 0) }))
        return
      }

      const meal = computeMealForPortion(scenario, 'Orta')
      addMealToDiary(meal)
      showToast(t('toast.mealAdded', { name: meal.name, kcal: fmtNumber(meal.calories_kcal, 0) }))
    })
  })

  // Side drawer menüsü -> modal
  const navButtons = Array.from(document.querySelectorAll?.('[data-deepcal-nav]') || [])
  const navModalOverlay = qs('#deepcal-nav-modal-overlay')
  const navModalCloseBtn = qs('#deepcal-nav-modal-close-btn')

  function closeDrawerUi() {
    const drawerPanel = qs('#deepcal-side-drawer')
    const drawerOv = qs('#deepcal-drawer-overlay')
    drawerPanel?.classList?.add?.('translate-x-full')
    drawerOv?.classList?.add?.('hidden')
  }

  const waterGoalMl = 2500

  function renderEmptyState() {
    return `<div class="rounded-2xl bg-slate-50/60 p-4 ring-1 ring-slate-100/70 text-sm text-slate-600">${t('common.empty')}</div>`
  }

  function renderWaterModal() {
    const dateKey = getTodayDateKey()
    const waterMl = readNumber(getDailyKey(DAILY_WATER_ML_KEY_PREFIX, dateKey), 0)
    const pct = Math.min(1, waterMl / waterGoalMl)
    const pctText = Math.round(pct * 100)

    return `
      <div class="grid grid-cols-1 sm:grid-cols-[1fr,1.1fr] gap-4 items-center mt-2">
        <div>
          <div class="text-xs font-semibold text-slate-500">${t('water.today')}</div>
          <div class="mt-1 text-4xl font-extrabold text-slate-900">
            ${fmtNumber(waterMl / 1000, 1)} <span class="text-lg font-semibold text-slate-500">L</span>
          </div>
          <div class="mt-2 text-sm text-slate-600">
            ${t('water.target')} <span class="font-semibold text-slate-900">${fmtNumber(waterGoalMl / 1000, 1)} L</span>
            <span class="ml-2 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-full ring-1 ring-purple-100">+${pctText}%</span>
          </div>

          <div class="mt-4 flex gap-3">
            <button id="deepcal-water-add-250" type="button" class="flex-1 rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-100/70 shadow-[0_18px_60px_rgba(2,6,23,0.06)] hover:bg-white transition">
              +250ml
            </button>
            <button id="deepcal-water-add-500" type="button" class="flex-1 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(124,58,237,0.25)] hover:from-purple-700 hover:to-indigo-900 transition">
              +500ml
            </button>
          </div>
        </div>

        <div class="relative">
          <div class="relative mx-auto h-56 w-28 rounded-[28px] bg-white/70 ring-1 ring-slate-200/80 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_18px_70px_rgba(2,6,23,0.08)]">
            <div id="deepcal-water-fill" class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-sky-500/85 to-blue-400/85 rounded-[28px] shadow-[0_-20px_60px_rgba(56,189,248,0.25)]" style="height: ${Math.round(pct * 100)}%"></div>
            <div class="absolute top-4 left-0 right-0 h-10 bg-white/20 blur-sm"></div>
            <div class="absolute bottom-3 left-3 right-3 h-2 bg-white/15 rounded-full blur-[1px]"></div>
            <div class="absolute top-3 left-3 h-2 w-2 rounded-full bg-white/25"></div>
          </div>

          <div class="mt-3 text-center text-xs text-slate-500">
            ${t('water.fullness')} <span class="font-semibold text-slate-800">${pctText}%</span>
          </div>
        </div>
      </div>
    `
  }

  function bindWaterHandlers() {
    const add250 = qs('#deepcal-water-add-250')
    const add500 = qs('#deepcal-water-add-500')
    const dateKey = getTodayDateKey()
    const waterKey = getDailyKey(DAILY_WATER_ML_KEY_PREFIX, dateKey)

    function updateAndReopen() {
      const rawMl = readNumber(waterKey, 0)
      openNavModal('water')
    }

    if (add250) {
      on(add250, 'click', (e) => {
        e?.preventDefault?.()
        const ml = readNumber(waterKey, 0)
        localStorage.setItem(waterKey, String(ml + 250))
        showToast(t('toast.waterAdded', { ml: '250' }))
        updateAndReopen()
      })
    }
    if (add500) {
      on(add500, 'click', (e) => {
        e?.preventDefault?.()
        const ml = readNumber(waterKey, 0)
        localStorage.setItem(waterKey, String(ml + 500))
        showToast(t('toast.waterAdded', { ml: '500' }))
        updateAndReopen()
      })
    }
  }

  function renderSettingsModal() {
    const profile = readJson(PROFILE_KEY, defaultProfile)
    const goal = Number(profile.dailyCalGoal || defaultProfile.dailyCalGoal)
    const height = Number(profile.heightCm || defaultProfile.heightCm)
    const weight = Number(profile.weightKg || defaultProfile.weightKg)
    const age = Number(profile.age || defaultProfile.age)
    const gender = String(profile.gender || defaultProfile.gender)

    return `
      <div class="mt-2 space-y-4">
        <!-- Tabs -->
        <div class="rounded-[26px] bg-slate-50/80 ring-1 ring-slate-100/80 p-1 flex gap-1">
          <button
            id="deepcal-settings-tab-profile"
            type="button"
            class="flex-1 rounded-[22px] px-3 py-2 text-sm font-semibold text-purple-700 bg-purple-50 ring-1 ring-purple-100 transition"
          >
            ${t('settings.tabs.profile')}
          </button>
          <button
            id="deepcal-settings-tab-goal"
            type="button"
            class="flex-1 rounded-[22px] px-3 py-2 text-sm font-semibold text-slate-600 bg-white/50 ring-1 ring-slate-100 transition opacity-90"
          >
            ${t('settings.tabs.goal')}
          </button>
        </div>

        <!-- Vücut Profili -->
        <div
          id="deepcal-settings-panel-profile"
          class="transition-opacity duration-200 ease-out opacity-100 max-h-[400px] overflow-hidden"
        >
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-xs font-semibold text-slate-600">
              ${t('settings.labels.height')}
              <input
                id="deepcal-settings-height"
                type="number"
                value="${height}"
                min="120"
                max="220"
                class="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              />
            </label>

            <label class="block text-xs font-semibold text-slate-600">
              ${t('settings.labels.weight')}
              <input
                id="deepcal-settings-weight"
                type="number"
                value="${weight}"
                min="30"
                max="220"
                class="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-3 mt-3">
            <label class="block text-xs font-semibold text-slate-600">
              ${t('settings.labels.age')}
              <input
                id="deepcal-settings-age"
                type="number"
                value="${age}"
                min="10"
                max="90"
                class="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              />
            </label>

            <label class="block text-xs font-semibold text-slate-600">
              ${t('settings.labels.gender')}
              <select
                id="deepcal-settings-gender"
                class="mt-2 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                <option value="Kadın" ${gender === 'Kadın' ? 'selected' : ''}>${t('settings.gender.woman')}</option>
                <option value="Erkek" ${gender === 'Erkek' ? 'selected' : ''}>${t('settings.gender.man')}</option>
              </select>
            </label>
          </div>
        </div>

        <!-- Beslenme Hedefi -->
        <div
          id="deepcal-settings-panel-goal"
          class="transition-opacity duration-200 ease-out opacity-0 max-h-0 overflow-hidden pointer-events-none"
        >
          <div class="rounded-3xl bg-slate-50/70 ring-1 ring-slate-100/80 p-4">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-slate-800">${t('settings.labels.dailyCalGoal')}</div>
              <div class="text-sm font-extrabold text-slate-900">
                <span id="deepcal-settings-goal-value">${fmtNumber(goal, 0)}</span> kcal
              </div>
            </div>

            <input
              id="deepcal-settings-goal-range"
              type="range"
              min="1200"
              max="3500"
              step="50"
              value="${goal}"
              class="mt-3 w-full accent-purple-600"
            />

            <div class="mt-1 text-xs text-slate-500 flex justify-between">
              <span>1200</span>
              <span>3500</span>
            </div>

            <div class="mt-4 grid grid-cols-3 gap-2">
              <button
                id="deepcal-settings-quick-cut"
                type="button"
                class="rounded-2xl bg-white/60 ring-1 ring-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition"
              >
                ${t('settings.quickGoal.cut')}
              </button>
              <button
                id="deepcal-settings-quick-keep"
                type="button"
                class="rounded-2xl bg-purple-50 ring-1 ring-purple-100 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition"
              >
                ${t('settings.quickGoal.keep')}
              </button>
              <button
                id="deepcal-settings-quick-gain"
                type="button"
                class="rounded-2xl bg-white/60 ring-1 ring-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition"
              >
                ${t('settings.quickGoal.gain')}
              </button>
            </div>
          </div>
        </div>

        <div>
          <button
            id="deepcal-settings-save-btn"
            type="button"
            class="w-full rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(124,58,237,0.25)] transition hover:from-purple-700 hover:to-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            ${t('settings.save')}
          </button>
        </div>
      </div>
    `
  }

  function bindSettingsHandlers() {
    const profile = readJson(PROFILE_KEY, defaultProfile)
    const goalRange = qs('#deepcal-settings-goal-range')
    const goalValue = qs('#deepcal-settings-goal-value')
    const saveBtn = qs('#deepcal-settings-save-btn')
    const tabProfile = qs('#deepcal-settings-tab-profile')
    const tabGoal = qs('#deepcal-settings-tab-goal')
    const panelProfile = qs('#deepcal-settings-panel-profile')
    const panelGoal = qs('#deepcal-settings-panel-goal')
    const quickCut = qs('#deepcal-settings-quick-cut')
    const quickKeep = qs('#deepcal-settings-quick-keep')
    const quickGain = qs('#deepcal-settings-quick-gain')

    if (goalRange && goalValue) {
      on(goalRange, 'input', () => {
        goalValue.textContent = fmtNumber(Number(goalRange.value || profile.dailyCalGoal), 0)
      })
    }

    function activateTab(next) {
      const isProfile = next === 'profile'

      if (tabProfile) {
        tabProfile.classList.toggle('bg-purple-50', isProfile)
        tabProfile.classList.toggle('text-purple-700', isProfile)
        tabProfile.classList.toggle('ring-purple-100', isProfile)

        tabProfile.classList.toggle('bg-white/50', !isProfile)
        tabProfile.classList.toggle('text-slate-600', !isProfile)
        tabProfile.classList.toggle('opacity-90', !isProfile)
      }

      if (tabGoal) {
        tabGoal.classList.toggle('bg-purple-50', !isProfile)
        tabGoal.classList.toggle('text-purple-700', !isProfile)
        tabGoal.classList.toggle('ring-purple-100', !isProfile)

        tabGoal.classList.toggle('bg-white/50', isProfile)
        tabGoal.classList.toggle('text-slate-600', isProfile)
        tabGoal.classList.toggle('opacity-90', isProfile)
      }

      if (panelProfile) {
        panelProfile.classList.toggle('opacity-100', isProfile)
        panelProfile.classList.toggle('max-h-[400px]', isProfile)
        panelProfile.classList.toggle('opacity-0', !isProfile)
        panelProfile.classList.toggle('max-h-0', !isProfile)
        panelProfile.classList.toggle('pointer-events-none', !isProfile)
      }

      if (panelGoal) {
        panelGoal.classList.toggle('opacity-0', isProfile)
        panelGoal.classList.toggle('max-h-0', isProfile)
        panelGoal.classList.toggle('pointer-events-none', isProfile)

        panelGoal.classList.toggle('opacity-100', !isProfile)
        panelGoal.classList.toggle('max-h-[400px]', !isProfile)
      }
    }

    activateTab('profile')

    on(tabProfile, 'click', (e) => {
      e?.preventDefault?.()
      activateTab('profile')
    })
    on(tabGoal, 'click', (e) => {
      e?.preventDefault?.()
      activateTab('goal')
    })

    function setGoalKcal(value) {
      if (!goalRange || !goalValue) return
      goalRange.value = String(value)
      goalValue.textContent = fmtNumber(Number(value), 0)
      // Trigger input for any extra bindings
      goalRange.dispatchEvent?.(new Event('input'))
    }

    on(quickCut, 'click', (e) => {
      e?.preventDefault?.()
      setGoalKcal(1500)
    })
    on(quickKeep, 'click', (e) => {
      e?.preventDefault?.()
      setGoalKcal(2000)
    })
    on(quickGain, 'click', (e) => {
      e?.preventDefault?.()
      setGoalKcal(2500)
    })

    on(saveBtn, 'click', (e) => {
      e?.preventDefault?.()
      const height = Number(qs('#deepcal-settings-height')?.value || defaultProfile.heightCm)
      const weight = Number(qs('#deepcal-settings-weight')?.value || defaultProfile.weightKg)
      const age = Number(qs('#deepcal-settings-age')?.value || defaultProfile.age)
      const gender = String(qs('#deepcal-settings-gender')?.value || defaultProfile.gender)
      const dailyCalGoal = Number(goalRange?.value || defaultProfile.dailyCalGoal)

      writeJson(PROFILE_KEY, {
        heightCm: height,
        weightKg: weight,
        age,
        gender,
        dailyCalGoal,
      })

      showToast(t('toast.settingsSaved'))
      closeNavModal()
    })
  }

  function renderHistoryModal() {
    const dateKey = getTodayDateKey()
    const history = readJson(getDailyKey(DAILY_HISTORY_KEY_PREFIX, dateKey), [])
    if (!Array.isArray(history) || !history.length) return renderEmptyState()

    const lang = getLanguage()
    const locale = lang === 'en' ? 'en-US' : 'tr-TR'
    const slotOrder = ['Kahvaltı', 'Öğle', 'Akşam']
    const slotLabelBySlot = {
      Kahvaltı: t('history.slot.breakfast'),
      Öğle: t('history.slot.lunch'),
      Akşam: t('history.slot.dinner'),
    }
    const grouped = slotOrder
      .map((slot) => {
        const entries = history.filter((h) => h.slot === slot)
        if (!entries.length) return null
        const total = entries.reduce((sum, x) => sum + Number(x.calories_kcal || 0), 0)
        const first = entries.slice().sort((a, b) => a.ts - b.ts)[0]
        return {
          slot,
          label: slotLabelBySlot[slot] || slot,
          total,
          time: new Date(first.ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        }
      })
      .filter(Boolean)

    if (!grouped.length) return renderEmptyState()

    const iconBySlot = {
      Kahvaltı: '🍳',
      Öğle: '🍛',
      Akşam: '🌙',
    }

    return `
      <div class="mt-2 space-y-3">
        ${grouped
          .map(
            (g) => `
          <div class="flex items-center justify-between rounded-2xl bg-slate-50/60 px-3.5 py-3 ring-1 ring-slate-100/70">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-2xl flex items-center justify-center bg-white/60 ring-1 ring-slate-100/80 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
                <span class="text-base">${iconBySlot[g.slot] || '🥗'}</span>
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-slate-800">${g.label}</span>
                <span class="text-xs text-slate-500">${g.time}</span>
              </div>
            </div>
            <div class="text-sm font-extrabold text-slate-900">${fmtNumber(g.total, 0)} kcal</div>
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  function renderStatsModal() {
    const macros = getDailyMacros()
    const proteinPct = Math.round(clamp01(macros.protein_g / (GOALS.protein_g || 1)) * 100)
    const fatPct = Math.round(clamp01(macros.fat_g / (GOALS.fat_g || 1)) * 100)
    const carbsPct = Math.round(clamp01(macros.carbs_g / (GOALS.carbs_g || 1)) * 100)

    const card = (id, label, pct, grams, colorClass) => {
      return `
        <div class="rounded-[26px] bg-white/60 ring-1 ring-slate-100/70 p-4 text-center shadow-[0_18px_70px_rgba(2,6,23,0.06)]">
          <div class="mx-auto h-20 w-20 relative">
            <svg viewBox="0 0 48 48" class="absolute inset-0">
              <circle cx="24" cy="24" r="18" stroke="rgba(148,163,184,0.25)" stroke-width="6" fill="none" />
              <circle id="${id}" cx="24" cy="24" r="18" stroke-width="6" stroke-linecap="round" fill="none" transform="rotate(-90 24 24)" stroke-dasharray="113.097" stroke-dashoffset="113.097" />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center flex-col">
              <div class="text-sm font-extrabold text-slate-900">${pct}%</div>
              <div class="text-[10px] font-semibold ${colorClass}">${label}</div>
            </div>
          </div>
          <div class="mt-3 text-xs font-semibold text-slate-600">
            ${fmtNumber(grams, 0)}g
          </div>
        </div>
      `
    }

    return `
      <div class="mt-2">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${card('deepcal-ring-protein', t('stats.rings.protein'), proteinPct, macros.protein_g, 'text-orange-700')}
          ${card('deepcal-ring-fat', t('stats.rings.fat'), fatPct, macros.fat_g, 'text-emerald-700')}
          ${card('deepcal-ring-carbs', t('stats.rings.carbs'), carbsPct, macros.carbs_g, 'text-blue-700')}
        </div>

        <div class="mt-4 rounded-3xl bg-slate-50/70 ring-1 ring-slate-100/80 p-4">
          <div class="flex items-center justify-between text-sm">
            <div class="font-semibold text-slate-800">${t('stats.todayTotalCalories')}</div>
            <div class="font-extrabold text-slate-900">${fmtNumber(macros.kcal, 0)} kcal</div>
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>${t('stats.targets.protein', { value: fmtNumber(GOALS.protein_g, 0) })}</span>
            <span>${t('stats.targets.fat', { value: fmtNumber(GOALS.fat_g, 0) })}</span>
            <span>${t('stats.targets.carbs', { value: fmtNumber(GOALS.carbs_g, 0) })}</span>
          </div>
        </div>
      </div>
    `
  }

  function bindStatsHandlers() {
    const macros = getDailyMacros()
    const proteinPct = Math.round(clamp01(macros.protein_g / (GOALS.protein_g || 1)) * 100)
    const fatPct = Math.round(clamp01(macros.fat_g / (GOALS.fat_g || 1)) * 100)
    const carbsPct = Math.round(clamp01(macros.carbs_g / (GOALS.carbs_g || 1)) * 100)

    const setRing = (circleId, pct, stroke) => {
      const el = qs(`#${circleId}`)
      if (!el) return
      const r = 18
      const circumference = 2 * Math.PI * r
      const dashOffset = circumference * (1 - pct / 100)
      el.setAttribute('stroke', stroke)
      el.setAttribute('stroke-dasharray', String(circumference))
      el.setAttribute('stroke-dashoffset', String(dashOffset))
    }

    setRing('deepcal-ring-protein', proteinPct, 'rgba(249,115,22,0.92)')
    setRing('deepcal-ring-fat', fatPct, 'rgba(16,185,129,0.92)')
    setRing('deepcal-ring-carbs', carbsPct, 'rgba(59,130,246,0.92)')
  }

  function openNavModal(key) {
    activeNavKey = key
    activeResultMeal = null
    if (key === 'water') {
      openModal(t('nav.water'), renderWaterModal(), bindWaterHandlers)
    } else if (key === 'settings') {
      openModal(t('nav.settings'), renderSettingsModal(), bindSettingsHandlers)
    } else if (key === 'history') {
      openModal(t('nav.history'), renderHistoryModal())
    } else if (key === 'stats') {
      openModal(t('nav.dailyStats'), renderStatsModal(), bindStatsHandlers)
    } else {
      openModal(t('nav.info'), `<div class="text-sm text-slate-600 p-2">${t('nav.notFound')}</div>`)
    }
  }

  navButtons.forEach((btn) => {
    on(btn, 'click', (e) => {
      e?.preventDefault?.()
      const key = btn.getAttribute('data-deepcal-nav')
      closeStaticProfilePopover()
      closeDrawerUi()
      openNavModal(key)
    })
  })

  // Modal overlay kapanma
  on(navModalOverlay, 'click', () => closeNavModal())
  on(navModalCloseBtn, 'click', () => closeNavModal())

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    closeNavModal()
  })
}

initStaticDashboard()

function render() {
  $app.innerHTML = `
    <div id="appShell" class="max-w-md mx-auto h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-x-hidden relative px-8">
      <header class="sticky top-0 z-20 -mx-8 flex items-center justify-between border-b border-slate-200/60 bg-white/85 px-8 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] backdrop-blur-md">
        <button id="menuBtn" type="button" class="dc-icon-btn" aria-label="Menü">
          <svg viewBox="0 0 24 24" class="h-5 w-5 text-slate-700" aria-hidden="true">
            <path fill="currentColor" d="M4 6.75A.75.75 0 0 1 4.75 6h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 6.75ZM4 12a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 12Zm0 5.25A.75.75 0 0 1 4.75 16.5h14.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1-.75-.75Z"/>
          </svg>
        </button>

        <div class="text-sm font-semibold tracking-wide text-slate-800">DeepCal</div>

        <div id="profileWrap" class="relative">
          <button id="profileBtn" type="button" class="dc-icon-btn" aria-label="Profil" aria-haspopup="menu" aria-expanded="false">
            <svg viewBox="0 0 24 24" class="h-5 w-5 text-slate-700" aria-hidden="true">
              <path fill="currentColor" d="M12 12a4 4 0 1 0-4-4a4 4 0 0 0 4 4Zm0 2c-3.87 0-7 2.24-7 5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1c0-2.76-3.13-5-7-5Z"/>
            </svg>
          </button>
        </div>
      </header>

      <main id="viewRoot" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full pt-6 pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"></main>

      <footer class="pb-6 text-center text-xs text-slate-400">
        
      </footer>
    </div>

    <aside id="sidebar" class="fixed inset-y-0 left-0 z-[999] hidden w-72 -translate-x-full transition-transform duration-300">
      <div class="h-full bg-white shadow-2xl ring-1 ring-slate-200">
        <div class="flex items-center justify-between px-5 py-5">
          <div class="text-xl font-bold tracking-tight text-slate-900">DeepCal</div>
          <button id="closeSidebarBtn" class="dc-icon-btn" aria-label="Menüyü kapat">
            <svg viewBox="0 0 24 24" class="h-5 w-5 text-slate-700" aria-hidden="true">
              <path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7A1 1 0 1 0 5.7 7.1l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"/>
            </svg>
          </button>
        </div>

        <nav class="px-3">
          <a data-route="home" class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors">
            <span class="h-2 w-2 rounded-full"></span>
            Ana Ekran
          </a>
          <a data-route="stats" class="mt-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors">
            <span class="h-2 w-2 rounded-full"></span>
            Günlük İstatistikler
          </a>
          <a data-route="settings" class="mt-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors">
            <span class="h-2 w-2 rounded-full"></span>
            Ayarlar
          </a>
        </nav>
      </div>
    </aside>
    <div id="sidebarBackdrop" class="fixed inset-0 z-[998] hidden bg-slate-900/30 backdrop-blur-sm"></div>

    <div id="profileBackdrop" class="fixed inset-0 z-[100] hidden bg-slate-900/20 backdrop-blur-sm"></div>

    <div id="profileDropdown" class="fixed hidden w-64 rounded-2xl border border-slate-100 bg-white shadow-2xl z-[110]" role="menu" aria-label="Profil menüsü">
      <div class="p-4 border-b border-slate-100">
        <div class="font-semibold text-slate-800">Seha</div>
        <div class="text-xs text-slate-500">seha@deepcal.com</div>
      </div>

      <div class="p-2">
        <div data-profile-action="account" role="menuitem"
          class="cursor-pointer flex items-center gap-3 rounded-xl p-3 text-slate-700 transition-colors hover:bg-slate-50 hover:text-purple-700">
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="text-sm font-medium">Hesabım</span>
        </div>

        <div data-profile-action="macros" role="menuitem"
          class="cursor-pointer flex items-center gap-3 rounded-xl p-3 text-slate-700 transition-colors hover:bg-slate-50 hover:text-purple-700">
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="13" r="8"></circle>
            <path d="M12 3v2"></path>
            <path d="M22 13h-2"></path>
            <path d="M4 13H2"></path>
            <path d="M6.34 6.34l1.42 1.42"></path>
            <path d="M17.66 6.34l-1.42 1.42"></path>
            <path d="M12 13l3-3"></path>
          </svg>
          <span class="text-sm font-medium">Makro Hedeflerim</span>
        </div>

        <div data-profile-action="settings" role="menuitem"
          class="cursor-pointer flex items-center gap-3 rounded-xl p-3 text-slate-700 transition-colors hover:bg-slate-50 hover:text-purple-700">
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.15.08a2 2 0 0 1-2 0l-.16-.09a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.18a2 2 0 0 1-1 1.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.16-.09a2 2 0 0 1 2 0l.15.08a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.15-.08a2 2 0 0 1 2 0l.16.09a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.73v-.18a2 2 0 0 1 1-1.73l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.16.09a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span class="text-sm font-medium">Ayarlar</span>
        </div>
      </div>

      <div class="border-t border-slate-100 p-2">
        <div data-profile-action="logout" role="menuitem"
          class="cursor-pointer flex items-center gap-3 rounded-xl p-3 text-red-600 transition-colors hover:bg-red-50">
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <path d="M16 17l5-5-5-5"></path>
            <path d="M21 12H9"></path>
          </svg>
          <span class="text-sm font-semibold">Çıkış Yap</span>
        </div>
      </div>
    </div>

    <div id="loadingOverlay" class="pointer-events-none fixed inset-0 z-[999] hidden items-center justify-center bg-slate-50/80 backdrop-blur-md">
      <div class="rounded-[2.5rem] bg-white p-8 ring-1 ring-slate-200 shadow-2xl">
        <div class="flex items-center gap-3">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600"></div>
          <div class="text-sm text-slate-700">Analiz ediliyor…</div>
        </div>
        <div class="mt-2 text-xs text-slate-500">Bu birkaç saniye sürebilir.</div>
        <button id="cancelBtn" type="button" class="dc-secondary-btn mt-3 w-full">İptal</button>
      </div>
    </div>

    <div id="sheetBackdrop" class="fixed inset-0 hidden bg-black/40 backdrop-blur-sm z-[90]"></div>
    <section id="resultSheet" class="fixed inset-0 hidden z-[100] translate-y-full transition-transform duration-300 overflow-y-auto">
      <div class="mx-auto flex min-h-full w-full max-w-md items-end px-5 py-6">
        <div class="relative w-full overflow-hidden rounded-[2.5rem] bg-white border border-slate-200 shadow-[0_18px_70px_rgba(0,0,0,0.20)]">
          <div class="pointer-events-none absolute -top-24 left-1/2 h-72 w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-purple-200/70 via-indigo-200/40 to-transparent blur-3xl"></div>
          <div class="pointer-events-none absolute -bottom-24 left-8 h-56 w-56 rounded-full bg-gradient-to-tr from-sky-200/50 to-transparent blur-2xl"></div>
          <button id="closeSheetBtn"
            class="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            aria-label="Kapat">
            <svg viewBox="0 0 24 24" class="h-6 w-6 text-slate-800" aria-hidden="true">
              <path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7A1 1 0 1 0 5.7 7.1l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"/>
            </svg>
          </button>
          <div class="flex items-center justify-center px-5 pt-4">
            <div class="h-1.5 w-12 rounded-full bg-slate-200"></div>
          </div>

          <div class="px-5 pb-5">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="truncate text-lg font-bold text-slate-800" id="foodName">—</div>
                <div class="mt-1 text-xs text-slate-500">Tahmini makrolar</div>
              </div>
              <div class="shrink-0 text-right">
                <div class="text-xs font-medium text-slate-500">Kalori</div>
                <div class="mt-1 text-2xl font-semibold tracking-tight text-slate-800"><span id="kcalValue">—</span> <span class="text-sm font-normal text-slate-500">kcal</span></div>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-3 gap-3">
              <div class="rounded-3xl bg-white/80 px-3 py-3 ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs font-semibold text-emerald-700">Protein</div>
                  <div class="text-xs text-slate-700"><span id="proteinValue">—</span><span class="text-slate-400">g</span></div>
                </div>
                <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div id="proteinBar" class="h-full w-0 rounded-full bg-gradient-to-r from-purple-600 to-indigo-800"></div>
                </div>
              </div>

              <div class="rounded-3xl bg-white/80 px-3 py-3 ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs font-semibold text-amber-700">Yağ</div>
                  <div class="text-xs text-slate-700"><span id="fatValue">—</span><span class="text-slate-400">g</span></div>
                </div>
                <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div id="fatBar" class="h-full w-0 rounded-full bg-gradient-to-r from-purple-600 to-indigo-800"></div>
                </div>
              </div>

              <div class="rounded-3xl bg-white/80 px-3 py-3 ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs font-semibold text-sky-700">Karb</div>
                  <div class="text-xs text-slate-700"><span id="carbValue">—</span><span class="text-slate-400">g</span></div>
                </div>
                <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div id="carbBar" class="h-full w-0 rounded-full bg-gradient-to-r from-purple-600 to-indigo-800"></div>
                </div>
              </div>
            </div>

            <div class="mt-5">
              <div class="text-xs font-medium text-slate-500">Porsiyon</div>
              <div class="mt-2 grid grid-cols-3 gap-2" id="portionRow"></div>
            </div>

            <div class="mt-5 flex gap-3">
              <button id="saveBtn" class="dc-primary-btn flex-1">Günlüğe Kaydet</button>
              <button id="retryBtn" class="dc-secondary-btn">Tekrar</button>
            </div>

            <div id="sheetMsg" class="mt-3 hidden text-xs text-slate-500"></div>
          </div>
        </div>
      </div>
    </section>
  `

  const viewRoot = qs('#viewRoot')
  const cameraBtn = qs('#cameraBtn')
  const imageInput = qs('#imageInput')
  const hint = qs('#hint')
  const loadingOverlay = qs('#loadingOverlay')
  const cancelBtn = qs('#cancelBtn')
  const menuBtn = qs('#menuBtn')
  const sidebar = qs('#sidebar')
  const sidebarBackdrop = qs('#sidebarBackdrop')
  const closeSidebarBtn = qs('#closeSidebarBtn')
  const sidebarNav = sidebar?.querySelector?.('nav')
  const profileWrap = qs('#profileWrap')
  const profileBtn = qs('#profileBtn')
  const profileDropdown = qs('#profileDropdown')
  const profileBackdrop = qs('#profileBackdrop')
  const sheetBackdrop = qs('#sheetBackdrop')
  const resultSheet = qs('#resultSheet')
  const closeSheetBtn = qs('#closeSheetBtn')
  const portionRow = qs('#portionRow')
  const saveBtn = qs('#saveBtn')
  const retryBtn = qs('#retryBtn')
  const sheetMsg = qs('#sheetMsg')
  const appShell = qs('#appShell')

  const foodName = qs('#foodName')
  const kcalValue = qs('#kcalValue')
  const proteinValue = qs('#proteinValue')
  const fatValue = qs('#fatValue')
  const carbValue = qs('#carbValue')

  const proteinBar = qs('#proteinBar')
  const fatBar = qs('#fatBar')
  const carbBar = qs('#carbBar')

  let abortController = null
  let lastAnalyze = null
  let selectedPortionKey = 'orta'
  let lastRawAi = null
  let route = 'home'
  let isProfileOpen = false
  let isDarkMode = false
  let isAnalyzing = false
  let showMealModal = false
  let selectedPortion = 'Orta'
  let detectedMeal = null
  let toastMessage = ''
  let consumedKcal = 1250

  const DARK_MODE_KEY = 'dc_dark_mode_v1'

  function getPortionMultiplier(label) {
    if (label === 'Küçük') return 0.75
    if (label === 'Büyük') return 1.25
    return 1.0 // Orta
  }

  function computeMealForPortion(base, portionLabel) {
    const m = getPortionMultiplier(portionLabel)
    return {
      name: base.name,
      calories_kcal: Math.round(Number(base.calories_kcal || 0) * m),
      protein_g: Math.round(Number(base.protein_g || 0) * m),
      fat_g: Math.round(Number(base.fat_g || 0) * m),
      carbs_g: Math.round(Number(base.carbs_g || 0) * m),
    }
  }

  function syncSidebarNavActive() {
    if (!sidebar) return
    const items = sidebar.querySelectorAll?.('[data-route]')
    if (!items?.length) return

    for (const el of items) {
      const key = el?.getAttribute?.('data-route')
      const isActive = key === route
      const dot = el?.querySelector?.('span')

      if (dot) {
        dot.classList.toggle('bg-purple-600', isActive)
        dot.classList.toggle('bg-slate-300', !isActive)
      }

      // Active
      el.classList.toggle('bg-purple-50/50', isActive)
      el.classList.toggle('p-2', isActive)
      el.classList.toggle('rounded-xl', isActive)
      el.classList.toggle('text-purple-700', isActive)
      el.classList.toggle('font-semibold', isActive)

      // Inactive
      el.classList.toggle('text-slate-500', !isActive)
      el.classList.toggle('font-medium', !isActive)
      el.classList.toggle('hover:bg-slate-50', !isActive)
      el.classList.toggle('transition-colors', !isActive)

      // Remove hover purple styles from previous iteration (legacy)
      el.classList.remove('hover:bg-purple-50', 'hover:text-purple-700', 'text-slate-700')
    }
  }

  function loadDarkMode() {
    try {
      const raw = localStorage.getItem(DARK_MODE_KEY)
      return raw === '1'
    } catch {
      return false
    }
  }

  function applyDarkMode(next) {
    isDarkMode = Boolean(next)
    document.documentElement.classList.toggle('dark', isDarkMode)
    try {
      localStorage.setItem(DARK_MODE_KEY, isDarkMode ? '1' : '0')
    } catch {
      // ignore storage failures
    }
  }

  function syncScrollLock() {
    const sidebarOpen = sidebar && !sidebar.classList.contains('hidden')
    const sheetOpen = resultSheet && !resultSheet.classList.contains('hidden')
    const shouldLock = Boolean(isProfileOpen || sidebarOpen || sheetOpen)
    viewRoot?.classList?.toggle?.('overflow-hidden', shouldLock)
  }

  function setProfileOpen(next) {
    isProfileOpen = Boolean(next)
    profileDropdown?.classList?.toggle?.('hidden', !isProfileOpen)
    profileBackdrop?.classList?.toggle?.('hidden', !isProfileOpen)
    profileBtn?.setAttribute?.('aria-expanded', isProfileOpen ? 'true' : 'false')
    if (isProfileOpen) positionProfileDropdown()
    syncScrollLock()
  }

  function positionProfileDropdown() {
    if (!profileBtn || !profileDropdown) return
    const rect = profileBtn.getBoundingClientRect()
    const dropdownWidth = profileDropdown.offsetWidth || 256
    const margin = 16
    const left = Math.max(
      margin,
      Math.min(window.innerWidth - margin - dropdownWidth, rect.right - dropdownWidth)
    )
    const top = rect.bottom + 12
    profileDropdown.style.left = `${Math.round(left)}px`
    profileDropdown.style.top = `${Math.round(top)}px`
  }

  function toggleProfile() {
    setProfileOpen(!isProfileOpen)
  }

  function closeProfile() {
    setProfileOpen(false)
  }

  function loadRecents() {
    try {
      const raw = localStorage.getItem(RECENTS_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function saveRecents(recents) {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(recents))
    } catch {
      // ignore storage failures (quota/private mode)
    }
  }

  async function makeThumbDataUrl(file) {
    if (!file) return null
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('read_failed'))
        reader.readAsDataURL(file)
      })

      const img = await new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('img_failed'))
        i.src = dataUrl
      })

      const maxSide = 240
      const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1))
      const w = Math.max(1, Math.round((img.width || 1) * scale))
      const h = Math.max(1, Math.round((img.height || 1) * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return null
      ctx.drawImage(img, 0, 0, w, h)
      return canvas.toDataURL('image/jpeg', 0.72)
    } catch {
      return null
    }
  }

  async function pushRecentMeal({ file, analyze }) {
    if (!analyze || typeof analyze !== 'object') return
    const ts = Date.now()
    const id = `${ts}-${Math.random().toString(16).slice(2)}`
    const thumb = await makeThumbDataUrl(file)

    const entry = {
      id,
      ts,
      food_name: analyze.food_name || 'Öğün',
      calories_kcal: Number(analyze.calories_kcal || 0),
      protein_g: Number(analyze.protein_g || 0),
      fat_g: Number(analyze.fat_g || 0),
      carbs_g: Number(analyze.carbs_g || 0),
      thumb,
    }

    const next = [entry, ...loadRecents()].slice(0, MAX_RECENTS)
    saveRecents(next)
    renderQuickMeals()
  }

  function renderQuickMeals() {
    if (route !== 'home') return
    const wrap = qs('#quickMeals')
    if (!wrap) return

    const recents = loadRecents()
    if (!recents.length) {
      wrap.innerHTML = `
        <div class="relative overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          <div class="pointer-events-none absolute inset-0 z-0 opacity-[0.05]">
            <div class="absolute left-8 top-10 -rotate-12 text-slate-800">
              <svg viewBox="0 0 24 24" class="h-9 w-9" aria-hidden="true">
                <path fill="currentColor" d="M12 2C9.2 2 7 4.2 7 7c0 4.2 5 8.5 5 8.5S17 11.2 17 7c0-2.8-2.2-5-5-5Zm0 3a2 2 0 0 1 2 2h-2V5Z"/>
              </svg>
            </div>
            <div class="absolute right-10 top-12 rotate-12 text-slate-800">
              <svg viewBox="0 0 24 24" class="h-8 w-8" aria-hidden="true">
                <path fill="currentColor" d="M7 4h10v7c0 3.3-2.7 6-6 6s-6-2.7-6-6V4h2Zm2 2v5c0 2.2 1.8 4 4 4s4-1.8 4-4V6H9Zm10 3h1c1.7 0 3 1.3 3 3s-1.3 3-3 3h-2v-2h2c.6 0 1-.4 1-1s-.4-1-1-1h-1V9Z"/>
              </svg>
            </div>
            <div class="absolute left-12 bottom-16 rotate-6 text-slate-800">
              <svg viewBox="0 0 24 24" class="h-9 w-9" aria-hidden="true">
                <path fill="currentColor" d="M12 5c4.4 0 8 3.6 8 8 0 2.6-1.3 4.9-3.3 6.3H7.3C5.3 17.9 4 15.6 4 13c0-4.4 3.6-8 8-8Zm-6 8c0 1.8.9 3.4 2.3 4.3h7.4c1.4-.9 2.3-2.5 2.3-4.3 0-3.3-2.7-6-6-6s-6 2.7-6 6Z"/>
              </svg>
            </div>
            <div class="absolute right-12 bottom-20 -rotate-12 text-slate-800">
              <svg viewBox="0 0 24 24" class="h-10 w-10" aria-hidden="true">
                <path fill="currentColor" d="M4 12c3.5-3.5 7-3.5 10.5 0C11 15.5 7.5 15.5 4 12Zm10 0c3.2-3.2 6.4-3.2 9.6 0c-3.2 3.2-6.4 3.2-9.6 0Zm2.4 0c1.2.6 2.4.6 3.6 0c-1.2-.6-2.4-.6-3.6 0Z"/>
              </svg>
            </div>
          </div>

          <div class="relative z-10 p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-slate-800">Hızlı Kayıt</div>
                <div class="mt-1 text-xs text-slate-500">Son 3 öğünün burada görünecek.</div>
              </div>
              <div class="dc-chip text-xs">
                <span class="h-1.5 w-1.5 rounded-full bg-purple-600"></span>
                AI
              </div>
            </div>

            <div class="mt-5 grid grid-cols-3 gap-4">
              <div class="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                <div class="aspect-square bg-slate-100">
                  <img src="${QUICK_PLACEHOLDERS.salata}" alt="" class="h-full w-full object-cover" />
                </div>
                <div class="px-3 py-2.5">
                  <div class="truncate text-xs font-semibold text-slate-800">Salata</div>
                  <div class="mt-1 text-[11px] text-slate-500">Hızlı ekleme</div>
                </div>
              </div>

              <div class="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                <div class="aspect-square bg-slate-100">
                  <img src="${QUICK_PLACEHOLDERS.filtreKahve}" alt="" class="h-full w-full object-cover" />
                </div>
                <div class="px-3 py-2.5">
                  <div class="truncate text-xs font-semibold text-slate-800">Filtre Kahve</div>
                  <div class="mt-1 text-[11px] text-slate-500">Hızlı ekleme</div>
                </div>
              </div>

              <div class="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                <div class="aspect-square bg-gradient-to-br from-slate-100 via-white to-slate-100"></div>
                <div class="px-3 py-2.5">
                  <div class="truncate text-xs font-semibold text-slate-800">Öğün</div>
                  <div class="mt-1 text-[11px] text-slate-500">Yakında</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `
      return
    }

    const dummyMeals = [
      { id: 'dummy-salata', food_name: 'Salata', calories_kcal: 320, thumb: QUICK_PLACEHOLDERS.salata },
      { id: 'dummy-filtre-kahve', food_name: 'Filtre Kahve', calories_kcal: 15, thumb: QUICK_PLACEHOLDERS.filtreKahve },
    ]

    const filled = [...recents]
    for (const d of dummyMeals) {
      if (filled.length >= 3) break
      filled.push(d)
    }

    wrap.innerHTML = `
      <div class="relative overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
        <div class="pointer-events-none absolute inset-0 z-0 opacity-[0.05]">
          <div class="absolute left-8 top-10 -rotate-12 text-slate-800">
            <svg viewBox="0 0 24 24" class="h-9 w-9" aria-hidden="true">
              <path fill="currentColor" d="M12 2C9.2 2 7 4.2 7 7c0 4.2 5 8.5 5 8.5S17 11.2 17 7c0-2.8-2.2-5-5-5Zm0 3a2 2 0 0 1 2 2h-2V5Z"/>
            </svg>
          </div>
          <div class="absolute right-10 top-12 rotate-12 text-slate-800">
            <svg viewBox="0 0 24 24" class="h-8 w-8" aria-hidden="true">
              <path fill="currentColor" d="M7 4h10v7c0 3.3-2.7 6-6 6s-6-2.7-6-6V4h2Zm2 2v5c0 2.2 1.8 4 4 4s4-1.8 4-4V6H9Zm10 3h1c1.7 0 3 1.3 3 3s-1.3 3-3 3h-2v-2h2c.6 0 1-.4 1-1s-.4-1-1-1h-1V9Z"/>
            </svg>
          </div>
          <div class="absolute left-12 bottom-16 rotate-6 text-slate-800">
            <svg viewBox="0 0 24 24" class="h-9 w-9" aria-hidden="true">
              <path fill="currentColor" d="M12 5c4.4 0 8 3.6 8 8 0 2.6-1.3 4.9-3.3 6.3H7.3C5.3 17.9 4 15.6 4 13c0-4.4 3.6-8 8-8Zm-6 8c0 1.8.9 3.4 2.3 4.3h7.4c1.4-.9 2.3-2.5 2.3-4.3 0-3.3-2.7-6-6-6s-6 2.7-6 6Z"/>
            </svg>
          </div>
          <div class="absolute right-12 bottom-20 -rotate-12 text-slate-800">
            <svg viewBox="0 0 24 24" class="h-10 w-10" aria-hidden="true">
              <path fill="currentColor" d="M4 12c3.5-3.5 7-3.5 10.5 0C11 15.5 7.5 15.5 4 12Zm10 0c3.2-3.2 6.4-3.2 9.6 0c-3.2 3.2-6.4 3.2-9.6 0Zm2.4 0c1.2.6 2.4.6 3.6 0c-1.2-.6-2.4-.6-3.6 0Z"/>
            </svg>
          </div>
        </div>

        <div class="relative z-10 flex items-center justify-between gap-3 p-6">
          <div>
            <div class="text-sm font-bold text-slate-800">Hızlı Kayıt</div>
            <div class="mt-1 text-xs text-slate-500">Son 3 öğün — dokun, porsiyon seç, kaydet.</div>
          </div>
          <div class="dc-chip text-xs">
            <span class="h-1.5 w-1.5 rounded-full bg-purple-600"></span>
            AI
          </div>
        </div>

        <div class="relative z-10 grid grid-cols-3 gap-4 px-6 pb-6">
          ${filled
            .map((m) => {
              const safeName = String(m.food_name || 'Öğün')
              const kcal = fmtNumber(m.calories_kcal || 0, 0)
              const img = m.thumb
                ? `<img src="${m.thumb}" alt="" class="h-full w-full object-cover" />`
                : `<div class="h-full w-full bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-transparent"></div>`

              return `
                <button type="button" data-quick-id="${m.id}"
                  class="group overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_60px_rgba(0,0,0,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">
                  <div class="aspect-square overflow-hidden bg-slate-100">
                    ${img}
                  </div>
                  <div class="px-3 py-2.5 text-left">
                    <div class="truncate text-xs font-semibold text-slate-800">${safeName}</div>
                    <div class="mt-1 text-[11px] text-slate-500">${kcal} kcal</div>
                  </div>
                </button>
              `
            })
            .join('')}
        </div>
      </div>
    `
  }

  function setHint(message) {
    if (!hint) return
    if (!message) {
      hint.classList.add('hidden')
      hint.textContent = ''
      return
    }
    hint.textContent = message
    hint.classList.remove('hidden')
  }

  function setLoading(isLoading) {
    if (!loadingOverlay) return
    loadingOverlay.classList.toggle('hidden', !isLoading)
    loadingOverlay.classList.toggle('flex', isLoading)
    loadingOverlay.classList.toggle('pointer-events-auto', isLoading)
    loadingOverlay.classList.toggle('pointer-events-none', !isLoading)
  }

  function setSheetMessage(message) {
    if (!sheetMsg) return
    if (!message) {
      sheetMsg.classList.add('hidden')
      sheetMsg.textContent = ''
      return
    }
    sheetMsg.textContent = message
    sheetMsg.classList.remove('hidden')
  }

  function openSheet() {
    sheetBackdrop?.classList.remove('hidden')
    resultSheet?.classList.remove('hidden')
    closeProfile()
    syncScrollLock()
    appShell?.classList.add('pointer-events-none', 'select-none')
    appShell?.setAttribute?.('aria-hidden', 'true')
    requestAnimationFrame(() => {
      resultSheet?.classList.remove('translate-y-full')
    })
  }

  function closeSheet() {
    resultSheet?.classList.add('translate-y-full')
    setTimeout(() => {
      resultSheet?.classList.add('hidden')
      sheetBackdrop?.classList.add('hidden')
      setSheetMessage('')
      syncScrollLock()
      appShell?.classList.remove('pointer-events-none', 'select-none')
      appShell?.removeAttribute?.('aria-hidden')
    }, 250)
  }

  function openSidebar() {
    if (!sidebar || !sidebarBackdrop) return
    sidebar.classList.remove('hidden')
    sidebarBackdrop.classList.remove('hidden')
    closeProfile()
    syncScrollLock()
    requestAnimationFrame(() => sidebar.classList.remove('-translate-x-full'))
  }

  function closeSidebar() {
    if (!sidebar || !sidebarBackdrop) return
    sidebar.classList.add('-translate-x-full')
    sidebarBackdrop.classList.add('hidden')
    syncScrollLock()
    setTimeout(() => sidebar.classList.add('hidden'), 250)
  }

  function renderHomeView() {
    if (!viewRoot) return
    const goalKcal = GOALS.calories_kcal
    const pct = Math.round(clamp01(consumedKcal / (goalKcal || 1)) * 100)

    const computedMeal = detectedMeal ? computeMealForPortion(detectedMeal, selectedPortion) : null
    const proteinPct = computedMeal ? Math.round(clamp01(computedMeal.protein_g / (GOALS.protein_g || 1)) * 100) : 0
    const fatPct = computedMeal ? Math.round(clamp01(computedMeal.fat_g / (GOALS.fat_g || 1)) * 100) : 0
    const carbPct = computedMeal ? Math.round(clamp01(computedMeal.carbs_g / (GOALS.carbs_g || 1)) * 100) : 0

    const mealModal = showMealModal
      ? `
        <div id="mealModalOverlay" class="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm">
          <div class="absolute bottom-0 w-full animate-slide-up bg-white rounded-t-3xl p-6 shadow-2xl" role="dialog" aria-modal="true" aria-label="Öğün ekleme paneli">
            <div class="relative">
              <div class="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4"></div>
              <button id="mealModalCloseBtn" type="button" class="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-slate-200/80 shadow-sm transition hover:bg-slate-50" aria-label="Kapat">
                <svg viewBox="0 0 24 24" class="h-5 w-5 text-slate-700" aria-hidden="true">
                  <path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7A1 1 0 1 0 5.7 7.1l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z"/>
                </svg>
              </button>
            </div>

            <div class="mt-2 text-center">
              <div class="text-xl font-bold text-slate-800">Tespit Edilen: ${computedMeal?.name || '—'}</div>
              <div class="mt-2 text-4xl font-extrabold text-slate-900">
                ${computedMeal ? fmtNumber(computedMeal.calories_kcal, 0) : '—'} <span class="text-lg font-semibold text-slate-500">kcal</span>
              </div>
            </div>

            <div class="mt-6">
              <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Porsiyon Boyutu</div>
              <div class="mt-3 grid grid-cols-3 gap-3" id="portionRowMock">
                ${['Küçük', 'Orta', 'Büyük']
                  .map((p) => {
                    const active = selectedPortion === p
                    const cls = active
                      ? 'bg-purple-50 border-purple-600 text-purple-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors'
                    return `
                      <button type="button" data-portion-mock="${p}"
                        class="rounded-2xl border px-4 py-3 text-sm ${cls} focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
                        ${p}
                      </button>
                    `
                  })
                  .join('')}
              </div>
            </div>

            <div class="mt-7">
              <div class="space-y-4">
                <div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span class="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-green-50 text-green-600 ring-1 ring-green-100">
                        <i data-lucide="leaf" class="h-4 w-4"></i>
                      </span>
                      Protein
                    </div>
                    <div class="text-sm font-semibold text-slate-800">${computedMeal ? fmtNumber(computedMeal.protein_g, 0) : '—'}g</div>
                  </div>
                  <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-green-500" style="width: ${proteinPct}%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span class="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                        <i data-lucide="flame" class="h-4 w-4"></i>
                      </span>
                      Yağ
                    </div>
                    <div class="text-sm font-semibold text-slate-800">${computedMeal ? fmtNumber(computedMeal.fat_g, 0) : '—'}g</div>
                  </div>
                  <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-orange-500" style="width: ${fatPct}%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span class="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                        <i data-lucide="droplets" class="h-4 w-4"></i>
                      </span>
                      Karbonhidrat
                    </div>
                    <div class="text-sm font-semibold text-slate-800">${computedMeal ? fmtNumber(computedMeal.carbs_g, 0) : '—'}g</div>
                  </div>
                  <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-blue-500" style="width: ${carbPct}%"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-7">
              <button id="confirmMealBtn" type="button" class="w-full rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(124,58,237,0.35)] transition hover:from-purple-700 hover:to-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
                Bu Öğünü Günlüğüme Ekle
              </button>
            </div>
          </div>
        </div>
      `
      : ''

    const toast = toastMessage
      ? `
        <div class="fixed inset-x-0 bottom-6 z-[120] flex justify-center px-6">
          <div class="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            <span class="h-1.5 w-1.5 rounded-full bg-white/90"></span>
            ${toastMessage}
          </div>
        </div>
      `
      : ''

    viewRoot.innerHTML = `
      <div class="flex flex-col gap-5 pb-24">
        <section class="w-full">
          <div class="pt-4">
            <div class="flex justify-between items-center w-full px-2">
              <div class="flex flex-col gap-0.5 leading-tight">
                <div class="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">Hoş geldiniz</div>
                <div class="text-sm font-medium text-slate-500 dark:text-slate-400">17 Mart 2026, Salı</div>
              </div>

              <div class="inline-flex items-center gap-1.5 rounded-full bg-orange-100/50 px-3 py-1.5 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
                <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                  <path fill="currentColor" d="M12 2c1 3-1 4-1 6s2 3 2 5-1 3-3 3-4-2-4-5c0-5 4-7 6-9Zm6 9c0 6-4 11-9 11s-7-4-7-8c0-3 2-6 5-8-1 3 1 4 2 5s2 2 2 4-1 3-3 3c4 0 5-4 5-7 3 2 5 5 5 10Z"/>
                </svg>
                <span class="text-sm font-bold">3. Gün Seri</span>
              </div>
            </div>
          </div>
        </section>

        <section class="w-full">
          <div class="rounded-3xl bg-white p-7 ring-1 ring-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-bold text-slate-800">Bugünün Özeti</div>
              <div class="text-xs font-medium text-slate-500">${pct}%</div>
            </div>
            <div class="mt-1 text-xs text-slate-500">Alınan: <span class="font-semibold text-slate-700">${fmtNumber(consumedKcal, 0)} kcal</span> / Hedef: <span class="font-semibold text-slate-700">${fmtNumber(goalKcal, 0)} kcal</span></div>
            <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div class="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-800" style="width: ${pct}%"></div>
            </div>
          </div>
        </section>

        <section class="w-full">
          <div class="relative overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div class="pointer-events-none absolute inset-0 z-0 opacity-[0.08]">
              <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent"></div>
              <div class="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(99,102,241,0.18),rgba(99,102,241,0.18)_1px,transparent_1px,transparent_12px)] opacity-30"></div>
              <div class="absolute inset-x-0 top-10 h-28 bg-gradient-to-b from-purple-500/20 via-indigo-500/10 to-transparent blur-2xl"></div>
            </div>

            <div class="relative z-10 px-10 py-8 text-center">
              <div class="text-sm font-bold text-slate-800">Öğününüzü buraya ekleyin</div>
              <div class="mt-1 text-xs font-medium text-slate-500">Fotoğraf çekin veya yükleyin</div>

              <div class="mt-5 flex justify-center">
                <button id="cameraBtn" type="button"
                  class="group relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-purple-700 to-indigo-900 shadow-[0_8px_30px_rgba(124,58,237,0.5)] ring-1 ring-purple-300/30 transition hover:shadow-[0_10px_34px_rgba(124,58,237,0.56)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
                  <div class="pointer-events-none absolute -inset-4 rounded-full bg-purple-500/18 blur-2xl opacity-90 animate-dc-breathe"></div>
                  <svg id="cameraIcon" viewBox="0 0 24 24" class="relative h-10 w-10 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)] ${isAnalyzing ? 'hidden' : ''}" aria-hidden="true">
                    <path fill="currentColor" d="M9 3a2 2 0 0 0-1.789 1.106L6.618 5.5H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-1.618l-.593-1.394A2 2 0 0 0 15 3H9Zm3 6a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z"/>
                  </svg>
                  <div id="cameraSpinner" class="relative ${isAnalyzing ? 'grid' : 'hidden'} place-items-center">
                    <i data-lucide="loader-2" class="h-10 w-10 text-white animate-spin"></i>
                  </div>
                </button>
              </div>

              <div class="mt-4">
                <div id="cameraAnalyzeText" class="${isAnalyzing ? '' : 'hidden'} text-xs font-medium text-slate-600">
                  Vision Analiz Ediyor...
                </div>
              </div>
            </div>
          </div>
        </section>

        <input id="imageInput" class="hidden" type="file" accept="image/*" capture="environment" />

        <div id="hint" class="hidden w-full text-left text-xs text-slate-500"></div>

        <section class="w-full">
          <div id="quickMeals"></div>
        </section>
      </div>
      ${mealModal}
      ${toast}
    `

    renderQuickMeals()
    createIcons({ icons })
  }

  async function renderStatsView() {
    if (!viewRoot) return
    const todayText = new Date().toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

    const goalKcal = 2000
    const consumedKcal = 1450
    const remainingKcal = Math.max(0, goalKcal - consumedKcal)
    const kcalPct = Math.round(clamp01(consumedKcal / (goalKcal || 1)) * 100)

    const macros = [
      { key: 'protein', label: 'Protein', unit: 'g', value: 80, goal: 120, color: 'emerald' },
      { key: 'fat', label: 'Yağ', unit: 'g', value: 45, goal: 70, color: 'amber' },
      { key: 'carb', label: 'Karbonhidrat', unit: 'g', value: 150, goal: 250, color: 'sky' },
    ]

    const meals = [
      { label: 'Kahvaltı', name: 'Yulaf Kasesi', kcal: 350, dot: 'bg-purple-500' },
      { label: 'Öğle', name: 'Tavuk Salata', kcal: 450, dot: 'bg-emerald-500' },
      { label: 'Akşam', name: 'Mantı', kcal: 650, dot: 'bg-amber-500' },
    ]

    viewRoot.innerHTML = `
      <div class="-mx-8 flex flex-1 flex-col bg-slate-50 px-8 pb-10">
        <div class="mb-6 pt-1">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center justify-center bg-purple-100 text-purple-600 p-2 rounded-xl">
                <i data-lucide="bar-chart-3" class="h-5 w-5"></i>
              </span>
              <div class="text-2xl font-bold text-slate-800">Günlük İstatistikler</div>
            </div>
            <div class="bg-white border border-slate-200 text-slate-500 px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
              ${todayText}
            </div>
          </div>
        </div>

        <section class="w-full">
          <div class="rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200/60">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-sm font-semibold text-slate-800">Günlük Kalori Hedefi: ${fmtNumber(goalKcal, 0)} kcal</div>
                <div class="mt-1 text-xs text-slate-500">Bugünkü özet (mock veri)</div>
              </div>
              <div class="text-right">
                <div class="text-xs font-medium text-slate-500">Tamamlanan</div>
                <div class="mt-1 text-lg font-semibold text-slate-800">${kcalPct}%</div>
              </div>
            </div>

            <div class="mt-5 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div class="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600" style="width: ${kcalPct}%"></div>
            </div>

            <div class="mt-4 flex items-center justify-between gap-3 text-sm">
              <div class="text-slate-600">Alınan: <span class="font-semibold text-slate-800">${fmtNumber(consumedKcal, 0)} kcal</span></div>
              <div class="text-slate-600">Kalan: <span class="font-semibold text-slate-800">${fmtNumber(remainingKcal, 0)} kcal</span></div>
            </div>
          </div>
        </section>

        <section class="mt-5 w-full">
          <div class="grid grid-cols-3 gap-4">
            ${macros
              .map((m) => {
                const pct = Math.round(clamp01(m.value / (m.goal || 1)) * 100)
                const bar =
                  m.color === 'emerald'
                    ? `bg-gradient-to-r from-emerald-500 to-emerald-600`
                    : m.color === 'amber'
                      ? `bg-gradient-to-r from-amber-500 to-orange-500`
                      : `bg-gradient-to-r from-sky-500 to-indigo-500`

                const icon =
                  m.color === 'emerald'
                    ? `<svg viewBox="0 0 24 24" class="h-5 w-5 text-emerald-600" aria-hidden="true"><path fill="currentColor" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5a2.5 2.5 0 0 1 0 5Z"/></svg>`
                    : m.color === 'amber'
                      ? `<svg viewBox="0 0 24 24" class="h-5 w-5 text-amber-600" aria-hidden="true"><path fill="currentColor" d="M13 2s-2 2.5-2 5a4 4 0 0 0 8 0c0-2.5-2-5-2-5s-1.1 2-2 2s-2-2-2-2ZM7 10a5 5 0 0 0 10 0H7Zm-1 2h12a7 7 0 0 1-12 0Z"/></svg>`
                      : `<svg viewBox="0 0 24 24" class="h-5 w-5 text-sky-600" aria-hidden="true"><path fill="currentColor" d="M12 3c4.4 0 8 3.6 8 8s-3.6 10-8 10S4 15.4 4 11s3.6-8 8-8Zm0 3a5 5 0 1 0 0 10a5 5 0 0 0 0-10Z"/></svg>`

                return `
                  <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
                    <div class="flex items-center justify-between gap-2">
                      <div class="text-xs font-semibold text-slate-700">${m.label}</div>
                      ${icon}
                    </div>
                    <div class="mt-2 text-sm font-semibold text-slate-800">${fmtNumber(m.value, 0)}${m.unit} <span class="text-xs font-medium text-slate-500">/ ${fmtNumber(m.goal, 0)}${m.unit}</span></div>
                    <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div class="h-full rounded-full ${bar}" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `
              })
              .join('')}
          </div>
        </section>

        <section class="mt-5 w-full">
          <div class="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-bold text-slate-800">Bugünün Öğünleri</div>
              <div class="text-xs font-medium text-slate-500">${meals.length} kayıt</div>
            </div>

            <div class="mt-4 divide-y divide-slate-100">
              ${meals
                .map(
                  (m) => `
                    <div class="flex items-center justify-between gap-4 py-3">
                      <div class="flex min-w-0 items-center gap-3">
                        <span class="h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}"></span>
                        <div class="min-w-0">
                          <div class="text-xs font-medium text-slate-500">${m.label}</div>
                          <div class="truncate text-sm font-semibold text-slate-800">${m.name}</div>
                        </div>
                      </div>
                      <div class="shrink-0 text-sm font-semibold text-slate-800">${fmtNumber(m.kcal, 0)} <span class="text-xs font-medium text-slate-500">kcal</span></div>
                    </div>
                  `
                )
                .join('')}
            </div>
          </div>
        </section>
      </div>
    `

    createIcons({ icons })
  }

  function renderSettingsView() {
    if (!viewRoot) return
    viewRoot.innerHTML = `
      <div class="-mx-8 min-h-screen bg-slate-50 px-8 pb-24 dark:bg-slate-900">
        <div class="mb-7 pt-1">
          <div class="text-3xl font-bold text-slate-800 dark:text-white">Ayarlar</div>
        </div>

        <section class="w-full">
          <div class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 dark:text-slate-400">Hesap & Hedefler</div>
          <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
            <div class="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <i data-lucide="user" class="h-5 w-5"></i>
                </span>
                <div class="text-sm font-medium text-slate-800 dark:text-slate-200">Kişisel Bilgiler</div>
              </div>
              <i data-lucide="chevron-right" class="h-5 w-5 text-slate-400 dark:text-slate-500"></i>
            </div>

            <div class="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <i data-lucide="target" class="h-5 w-5"></i>
                </span>
                <div class="text-sm font-medium text-slate-800 dark:text-slate-200">Makro ve Kalori Hedefleri</div>
              </div>
              <div class="flex items-center gap-2">
                <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">2.000 kcal</div>
                <i data-lucide="chevron-right" class="h-5 w-5 text-slate-400 dark:text-slate-500"></i>
              </div>
            </div>
          </div>
        </section>

        <section class="mt-7 w-full">
          <div class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 dark:text-slate-400">Tercihler</div>
          <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
            <button id="darkModeRow" type="button" class="w-full text-left flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <i data-lucide="moon" class="h-5 w-5"></i>
                </span>
                <div class="text-sm font-medium text-slate-800 dark:text-slate-200">Karanlık Mod</div>
              </div>
              <div id="darkModeToggle" class="relative h-6 w-11 rounded-full bg-slate-200 ring-1 ring-slate-300/50 transition-all duration-300">
                <span id="darkModeKnob" class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300"></span>
              </div>
            </button>

            <div class="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <i data-lucide="bell" class="h-5 w-5"></i>
                </span>
                <div class="text-sm font-medium text-slate-800 dark:text-slate-200">Bildirimler</div>
              </div>
              <div class="relative h-6 w-11 rounded-full bg-purple-600 ring-1 ring-purple-500/30">
                <span class="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"></span>
              </div>
            </div>

            <div class="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <i data-lucide="globe" class="h-5 w-5"></i>
                </span>
                <div class="text-sm font-medium text-slate-800 dark:text-slate-200">Dil</div>
              </div>
              <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">Türkçe</div>
            </div>
          </div>
        </section>

        <section class="mt-7 w-full">
          <div class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 dark:text-slate-400">Diğer</div>
          <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
            <div class="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <i data-lucide="shield" class="h-5 w-5"></i>
                </span>
                <div class="text-sm font-medium text-slate-800 dark:text-slate-200">Gizlilik Politikası</div>
              </div>
              <i data-lucide="chevron-right" class="h-5 w-5 text-slate-400 dark:text-slate-500"></i>
            </div>

            <div class="flex justify-between items-center p-4 hover:bg-red-50 cursor-pointer transition-colors">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <i data-lucide="log-out" class="h-5 w-5"></i>
                </span>
                <div class="text-sm text-red-500 font-medium">Çıkış Yap</div>
              </div>
              <i data-lucide="chevron-right" class="h-5 w-5 text-red-300"></i>
            </div>
          </div>
        </section>
      </div>
    `

    createIcons({ icons })

    const darkModeRow = qs('#darkModeRow')
    const toggle = qs('#darkModeToggle')
    const knob = qs('#darkModeKnob')

    function syncDarkToggle() {
      toggle?.classList?.toggle?.('bg-purple-600', isDarkMode)
      toggle?.classList?.toggle?.('bg-slate-200', !isDarkMode)
      knob?.classList?.toggle?.('translate-x-5', isDarkMode)
      knob?.classList?.toggle?.('translate-x-0', !isDarkMode)
    }

    isDarkMode = loadDarkMode()
    applyDarkMode(isDarkMode)
    syncDarkToggle()

    on(darkModeRow, 'click', (e) => {
      e?.preventDefault?.()
      applyDarkMode(!isDarkMode)
      syncDarkToggle()
    })
  }

  async function setRoute(next) {
    route = next
    if (route === 'home') renderHomeView()
    if (route === 'stats') await renderStatsView()
    if (route === 'settings') renderSettingsView()

    bindHomeHandlers()
    syncSidebarNavActive()
  }

  function refreshHomeView() {
    if (route !== 'home') return
    renderHomeView()
    bindHomeHandlers()
  }

  function bindHomeHandlers() {
    const _cameraBtn = qs('#cameraBtn')
    const _imageInput = qs('#imageInput')
    const _hint = qs('#hint')
    const _quickMeals = qs('#quickMeals')
    const _mealModalOverlay = qs('#mealModalOverlay')
    const _mealModalCloseBtn = qs('#mealModalCloseBtn')
    const _portionRowMock = qs('#portionRowMock')
    const _confirmMealBtn = qs('#confirmMealBtn')

    function _setHint(message) {
      if (!_hint) return
      if (!message) {
        _hint.classList.add('hidden')
        _hint.textContent = ''
        return
      }
      _hint.textContent = message
      _hint.classList.remove('hidden')
    }

    on(_cameraBtn, 'click', () => _imageInput?.click())

    on(_imageInput, 'change', async () => {
      const file = _imageInput?.files?.[0]
      if (!file) return

      _setHint('')
      setSheetMessage('')
      const validation = validateImageFile(file, { maxBytes: MAX_IMAGE_BYTES })
      if (!validation.ok) {
        _setHint(validation.message)
        _imageInput.value = ''
        return
      }

      // Mock AI flow for demo: no network calls.
      isAnalyzing = true
      showMealModal = false
      selectedPortion = 'Orta'
      detectedMeal = null
      refreshHomeView()

      setTimeout(() => {
        isAnalyzing = false
        detectedMeal = pickMealScenario(file)
        showMealModal = true
        refreshHomeView()
      }, 2000)

      _imageInput.value = ''
    })

    on(_mealModalOverlay, 'click', (e) => {
      // Overlay click closes; panel click should not.
      if (e.target?.id !== 'mealModalOverlay') return
      showMealModal = false
      refreshHomeView()
    })

    on(_mealModalCloseBtn, 'click', (e) => {
      e?.preventDefault?.()
      showMealModal = false
      refreshHomeView()
    })

    on(_portionRowMock, 'click', (e) => {
      const btn = e.target?.closest?.('[data-portion-mock]')
      const p = btn?.getAttribute?.('data-portion-mock')
      if (!p) return
      selectedPortion = p
      refreshHomeView()
    })

    on(_confirmMealBtn, 'click', (e) => {
      e?.preventDefault?.()
      showMealModal = false
      const computed = detectedMeal ? computeMealForPortion(detectedMeal, selectedPortion) : null
      if (computed) consumedKcal += Number(computed.calories_kcal || 0)
      toastMessage = computed ? `${computed.name} günlüğe eklendi.` : 'Öğün günlüğe eklendi.'
      refreshHomeView()
      setTimeout(() => {
        toastMessage = ''
        refreshHomeView()
      }, 2200)
    })

    on(_quickMeals, 'click', (e) => {
      const btn = e.target?.closest?.('[data-quick-id]')
      const id = btn?.getAttribute?.('data-quick-id')
      if (!id) return
      const recents = loadRecents()
      const picked = recents.find((m) => m.id === id)
      if (!picked) return

      lastAnalyze = {
        food_name: picked.food_name,
        calories_kcal: picked.calories_kcal,
        protein_g: picked.protein_g,
        fat_g: picked.fat_g,
        carbs_g: picked.carbs_g,
      }
      lastRawAi = null
      selectedPortionKey = 'orta'
      renderPortions()
      renderResult()
      openSheet()
    })
  }

  function computeMacros(base, multiplier) {
    return {
      calories_kcal: Number(base.calories_kcal) * multiplier,
      protein_g: Number(base.protein_g) * multiplier,
      fat_g: Number(base.fat_g) * multiplier,
      carbs_g: Number(base.carbs_g) * multiplier,
    }
  }

  function renderPortions() {
    if (!portionRow) return
    portionRow.innerHTML = PORTIONS.map((p) => {
      const active = p.key === selectedPortionKey
      return `
        <button type="button" data-portion="${p.key}"
          class="${active ? 'bg-gradient-to-br from-purple-600 to-indigo-800 text-white ring-purple-200' : 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200'} inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-semibold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">
          ${p.label}
        </button>
      `
    }).join('')
  }

  function renderResult() {
    if (!lastAnalyze) return
    const portion = PORTIONS.find((p) => p.key === selectedPortionKey) || PORTIONS[1]
    const computed = computeMacros(lastAnalyze, portion.multiplier)

    if (foodName) foodName.textContent = lastAnalyze.food_name || '—'
    if (kcalValue) kcalValue.textContent = fmtNumber(computed.calories_kcal, 0)
    if (proteinValue) proteinValue.textContent = fmtNumber(computed.protein_g, 0)
    if (fatValue) fatValue.textContent = fmtNumber(computed.fat_g, 0)
    if (carbValue) carbValue.textContent = fmtNumber(computed.carbs_g, 0)

    const proteinPct = clamp01(computed.protein_g / GOALS.protein_g)
    const fatPct = clamp01(computed.fat_g / GOALS.fat_g)
    const carbPct = clamp01(computed.carbs_g / GOALS.carbs_g)

    if (proteinBar) proteinBar.style.width = `${Math.round(proteinPct * 100)}%`
    if (fatBar) fatBar.style.width = `${Math.round(fatPct * 100)}%`
    if (carbBar) carbBar.style.width = `${Math.round(carbPct * 100)}%`
  }

  on(cancelBtn, 'click', () => {
    abortController?.abort()
    abortController = null
    setLoading(false)
    setHint('İşlem iptal edildi.')
  })

  on(menuBtn, 'click', openSidebar)
  on(closeSidebarBtn, 'click', closeSidebar)
  on(sidebarBackdrop, 'click', closeSidebar)

  on(profileBtn, 'click', (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    toggleProfile()
  })

  on(profileBackdrop, 'click', closeProfile)

  on(profileDropdown, 'click', (e) => {
    const item = e.target?.closest?.('[data-profile-action]')
    const action = item?.getAttribute?.('data-profile-action')
    if (!action) return
    closeProfile()
    // MVP: demo menü — aksiyonları sonra bağlarız.
  })

  document.addEventListener('click', (e) => {
    if (!isProfileOpen) return
    if (profileWrap?.contains?.(e.target)) return
    closeProfile()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (!isProfileOpen) return
    closeProfile()
  })

  window.addEventListener('resize', () => {
    if (!isProfileOpen) return
    positionProfileDropdown()
  })

  window.addEventListener('scroll', () => {
    if (!isProfileOpen) return
    positionProfileDropdown()
  }, true)

  on(sidebarNav, 'click', async (e) => {
    const a = e.target?.closest?.('[data-route]')
    const next = a?.getAttribute?.('data-route')
    if (!next) return
    closeSidebar()
    await setRoute(next)
  })

  on(sheetBackdrop, 'click', closeSheet)
  on(closeSheetBtn, 'click', closeSheet)

  on(portionRow, 'click', (e) => {
    const btn = e.target?.closest?.('[data-portion]')
    const key = btn?.getAttribute?.('data-portion')
    if (!key) return
    selectedPortionKey = key
    renderPortions()
    renderResult()
  })

  on(retryBtn, 'click', () => {
    closeSheet()
    if (route !== 'home') setRoute('home')
    setTimeout(() => qs('#imageInput')?.click(), 0)
  })

  on(saveBtn, 'click', async () => {
    if (!lastAnalyze) return
    const portion = PORTIONS.find((p) => p.key === selectedPortionKey) || PORTIONS[1]
    const computed = computeMacros(lastAnalyze, portion.multiplier)

    saveBtn.disabled = true
    setSheetMessage('Kaydediliyor…')
    try {
      await createLogEntry({
        food_name: lastAnalyze.food_name,
        portion: portion.key,
        multiplier: portion.multiplier,
        ...computed,
        source: 'ai',
        raw_ai_response: lastRawAi,
      })
      setSheetMessage('Kaydedildi.')
      setTimeout(() => {
        closeSheet()
        if (route !== 'home') setRoute('home')
        setTimeout(() => {
          const _hint = qs('#hint')
          if (_hint) {
            _hint.textContent = 'Öğün günlüğe eklendi.'
            _hint.classList.remove('hidden')
          }
        }, 0)
      }, 300)
    } catch (err) {
      setSheetMessage(err?.message || 'Kayıt başarısız.')
    } finally {
      saveBtn.disabled = false
    }
  })

  syncSidebarNavActive()
  setRoute('home')
}

if ($app) render()
