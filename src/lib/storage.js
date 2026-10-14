/**
 * localStorage persistence (FR-9). Everything is namespaced and every call is
 * defensive: private browsing or a full disk must degrade to "works for this session".
 */
const PREFIX = 'namma-yatri:'
const KEYS = {
  prefs: `${PREFIX}prefs`,
  itinerary: `${PREFIX}itinerary`,
  drafts: `${PREFIX}drafts`,
  narration: `${PREFIX}narration`
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const DEFAULT_PREFS = {
  interests: ['heritage'],
  days: 3,
  budget: 'comfort',
  startCity: 'Bengaluru'
}

export function loadPrefs() {
  const stored = read(KEYS.prefs, null)
  if (!stored) return { ...DEFAULT_PREFS }
  return {
    interests: Array.isArray(stored.interests) && stored.interests.length ? stored.interests : DEFAULT_PREFS.interests,
    days: Math.min(7, Math.max(1, Number(stored.days) || DEFAULT_PREFS.days)),
    budget: ['budget', 'comfort', 'premium'].includes(stored.budget) ? stored.budget : DEFAULT_PREFS.budget,
    startCity: stored.startCity || DEFAULT_PREFS.startCity
  }
}

export function savePrefs(prefs) {
  return write(KEYS.prefs, prefs)
}

export function loadItinerary() {
  const it = read(KEYS.itinerary, null)
  if (!it || !Array.isArray(it.days) || !it.days.length) return null
  return it
}

export function saveItinerary(itinerary) {
  return write(KEYS.itinerary, itinerary)
}

export function clearTrip() {
  try {
    localStorage.removeItem(KEYS.itinerary)
  } catch {
    /* nothing to clear */
  }
}

/** Recently planned trips — the "my trips" list on the home screen. */
export function loadDrafts() {
  return read(KEYS.drafts, [])
}

export function pushDraft(itinerary, limit = 6) {
  const list = loadDrafts().filter((d) => d.tripId !== itinerary.tripId)
  list.unshift({
    tripId: itinerary.tripId,
    dayCount: itinerary.dayCount,
    days: itinerary.dayCount,
    budget: itinerary.tier,
    tierLabel: itinerary.tierLabel,
    startCity: itinerary.startCity,
    interests: itinerary.interests,
    regions: itinerary.regions,
    savedAt: new Date().toISOString()
  })
  write(KEYS.drafts, list.slice(0, limit))
}

/** AI narration cache — an hour of offline reading after one network round-trip. */
const NARR_TTL = 60 * 60 * 1000

export function cachedNarration(key) {
  const store = read(KEYS.narration, {})
  const hit = store[key]
  if (!hit) return null
  if (Date.now() - hit.at > NARR_TTL) {
    delete store[key]
    write(KEYS.narration, store)
    return null
  }
  return hit.text
}

export function putNarration(key, text) {
  if (!text) return
  const store = read(KEYS.narration, {})
  store[key] = { text, at: Date.now() }
  const keys = Object.keys(store)
  if (keys.length > 80) {
    for (const k of keys.sort((a, b) => store[a].at - store[b].at).slice(0, keys.length - 80)) {
      delete store[k]
    }
  }
  write(KEYS.narration, store)
}
