/**
 * NarrationService — the thin AI layer.
 *
 * The engine's template narration is always present in the data, so this service only
 * ever *replaces* text, never supplies it. No key, no network, a slow model, a 500: in
 * every one of those cases the caller keeps what it already had and the UI is unchanged
 * (FR-8, NFR-5). Results are cached in localStorage for an hour.
 */
import { cachedNarration, putNarration } from './storage'

const ENDPOINT = '/api/narrate'
const TIMEOUT_MS = 11000

let listener = null
let state = { checked: false, ai: false, reason: 'unknown' }

function notify() {
  if (listener) listener({ ...state })
}

export function onNarrationStatus(fn) {
  listener = fn
  fn({ ...state })
  return () => {
    if (listener === fn) listener = null
  }
}

export function narrationStatus() {
  return { ...state }
}

/**
 * Ask the serverless function for AI prose for one day or one place.
 * @returns {Promise<{text: string|null, source: 'ai'|'cache'|'template', reason?: string}>}
 */
export async function narrate(target, fallbackText) {
  const key = cacheKey(target)
  if (key) {
    const hit = cachedNarration(key)
    if (hit) return { text: hit, source: 'cache' }
  }

  const body = {
    kind: target.kind,
    day: target.day,
    place: target.place,
    ctx: target.ctx || {}
  }

  let json
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!res.ok) {
      state = { checked: true, ai: false, reason: `http-${res.status}` }
      notify()
      return { text: null, source: 'template', reason: `http-${res.status}` }
    }
    json = await res.json()
  } catch (e) {
    state = { checked: true, ai: false, reason: e.name === 'AbortError' ? 'timeout' : 'offline' }
    notify()
    return { text: null, source: 'template', reason: state.reason }
  }

  if (json && json.fallback) {
    state = { checked: true, ai: false, reason: json.reason || 'fallback' }
    notify()
    return { text: null, source: 'template', reason: json.reason }
  }

  const text = typeof json?.narration === 'string' ? json.narration.trim() : ''
  if (!text) {
    state = { checked: true, ai: false, reason: 'empty' }
    notify()
    return { text: null, source: 'template', reason: 'empty' }
  }

  state = { checked: true, ai: true, reason: json.provider || 'ok' }
  notify()
  putNarration(key, text)
  return { text, source: 'ai' }
}

function cacheKey(target) {
  if (target.kind === 'place' && target.place?.id) return `place:${target.place.id}`
  if (target.kind === 'day' && target.day) {
    const ids = (target.day.stops || []).map((s) => s.placeId).join(',')
    return `day:${target.tripId || ''}:${target.day.day}:${ids}`
  }
  return null
}

/** Cheap probe used by the UI badge: is the AI layer live for this visitor? */
export async function probe() {
  if (state.checked) return { ...state }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'probe' })
    })
    const json = await res.json().catch(() => ({}))
    // honest only: the badge lights up when a key exists on the server, never before
    state = {
      checked: true,
      ai: res.ok && json.hasKey === true,
      reason: json.provider || json.reason || (res.ok ? 'ready' : `http-${res.status}`)
    }
  } catch {
    state = { checked: true, ai: false, reason: 'offline' }
  }
  notify()
  return { ...state }
}
