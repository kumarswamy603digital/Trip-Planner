/**
 * NammaYatri AI — narration handler
 *
 * One handler, two homes:
 *   • `api/narrate.js`   — wraps it as a Vercel serverless function in production
 *   • `vite.config.js`   — mounts it as middleware on POST /api/narrate in `npm run dev`
 *
 * Provider-agnostic and key-optional. If no key is configured, if the network is down,
 * or if the provider answers with anything unexpected, the handler returns
 * `{ fallback: true }` with a 200 status — never a 5xx. The client then keeps the
 * template narration it already has, so the UI is identical with or without AI (NFR-5).
 */
import fs from 'node:fs'
import path from 'node:path'

const SYSTEM = `You are a warm, sharply observant local guide from Karnataka planning a trip for a traveller.
You are given one day of an itinerary as structured data. Write the day back as living prose.

Rules:
- 70 to 110 words, one or two paragraphs, second person ("you").
- Name the places exactly as given. Never invent a place, a price, a deity, a date or a tradition.
- Anchor the day in time: say what to do first, where the middle of the day goes, what the evening is.
- Weave in one concrete, practical detail (best light, crowd timing, what to carry, how to get between stops).
- Add one line of local colour that a guidebook would not bother to print.
- Mention Kannada once where it genuinely helps the traveller, without lecturing.
- Plain text only: no markdown, no headings, no bullet points, no emoji.
- If the traveller's interests are given, let them decide what you dwell on.`

const PLACE_SYSTEM = `You are a warm, sharply observant local guide from Karnataka.
You are given one place as structured data. Write a 45 to 70 second read for a traveller standing in front of it.

Rules:
- 60 to 90 words, plain text, no markdown, no headings, no bullets, no emoji.
- Say what you are actually looking at, then what it took to build or is still used for, then one detail most visitors miss.
- Use only the facts given. Never invent dates, rulers, rituals, prices or legends.
- End with one practical line: when to go, what to carry, or what to ask for.`

/** Minimal .env reader so `npm run dev` works without a dotenv dependency. */
function readLocalEnv() {
  const out = {}
  try {
    const file = path.resolve(process.cwd(), '.env')
    if (!fs.existsSync(file)) return out
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !line.trim().startsWith('#')) {
        out[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    /* a missing or unreadable .env just means "no key" — the fallback covers it */
  }
  return out
}

function env(name) {
  return process.env[name] || readLocalEnv()[name] || ''
}

function providerName() {
  const p = (env('NARRATE_PROVIDER') || 'openai').toLowerCase()
  return ['openai', 'anthropic', 'gemini'].includes(p) ? p : 'openai'
}

/** True when the deployed/locally available key for the chosen provider exists. */
export function hasKey() {
  const p = providerName()
  if (p === 'openai') return !!env('OPENAI_API_KEY')
  if (p === 'anthropic') return !!env('ANTHROPIC_API_KEY')
  return !!env('GEMINI_API_KEY')
}

const TIMEOUT_MS = 9000

async function callProvider(payload) {
  const p = providerName()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    if (p === 'openai') {
      const key = env('OPENAI_API_KEY')
      const model = env('OPENAI_MODEL') || 'gpt-4o-mini'
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.75,
          max_tokens: 260,
          messages: [
            { role: 'system', content: payload.kind === 'place' ? PLACE_SYSTEM : SYSTEM },
            { role: 'user', content: payload.prompt }
          ]
        })
      })
      if (!res.ok) return { error: `openai ${res.status}` }
      const json = await res.json()
      return { text: json.choices?.[0]?.message?.content?.trim(), provider: `openai:${model}` }
    }

    if (p === 'anthropic') {
      const key = env('ANTHROPIC_API_KEY')
      const model = env('ANTHROPIC_MODEL') || 'claude-haiku-4-5'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          system: payload.kind === 'place' ? PLACE_SYSTEM : SYSTEM,
          messages: [{ role: 'user', content: payload.prompt }]
        })
      })
      if (!res.ok) return { error: `anthropic ${res.status}` }
      const json = await res.json()
      const text = (json.content || []).map((b) => b.text || '').join('').trim()
      return { text, provider: `anthropic:${model}` }
    }

    const key = env('GEMINI_API_KEY')
    const model = env('GEMINI_MODEL') || 'gemini-1.5-flash'
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: payload.kind === 'place' ? PLACE_SYSTEM : SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: payload.prompt }] }],
          generationConfig: { temperature: 0.75, maxOutputTokens: 300 }
        })
      }
    )
    if (!res.ok) return { error: `gemini ${res.status}` }
    const json = await res.json()
    const text = json.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('').trim()
    return { text, provider: `gemini:${model}` }
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : e.message }
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ prompts */

function dayPrompt(day, ctx = {}) {
  const stops = (day.stops || []).map((s) => {
    const p = s.place || {}
    return [
      `${s.startAt || ''} ${p.name} (${p.kannada || ''}, ${p.category?.join('/')})`,
      `about ${s.durationHrs}h, entry ₹${s.estCost ?? 0}`,
      p.desc || '',
      s.why || ''
    ]
      .filter(Boolean)
      .join(' — ')
  })
  return [
    `Day ${day.day} of a ${(ctx.dayCount || 3)}-day Karnataka trip.`,
    `Day base: ${day.base}. Region: ${day.region}.`,
    ctx.startCity ? `Traveller started from ${ctx.startCity}.` : '',
    ctx.interests?.length ? `Interests: ${ctx.interests.join(', ')}.` : '',
    ctx.tierLabel ? `Budget tier: ${ctx.tierLabel}, day budget ₹${day.dayCost}.` : `Day budget ₹${day.dayCost}.`,
    day.travelLeg ? `Travel leg into the day: ${day.travelLeg.km} km, about ${day.travelLeg.hours} h. ${day.travelLeg.note || ''}` : '',
    day.gettingAround ? `Getting around: ${day.gettingAround}` : '',
    `Stops:\n- ${stops.join('\n- ')}`,
    'Write this day.'
  ]
    .filter(Boolean)
    .join('\n')
}

function placePrompt(place, ctx = {}) {
  return [
    `Place: ${place.name}${place.kannada ? ` (${place.kannada})` : ''}.`,
    `Where: ${place.subRegion || ''}, ${place.region} region, Karnataka.`,
    `Known for: ${(place.category || []).join(', ')}. Popularity ${place.popularity}/10.`,
    `Entry ₹${place.entryCost}, about ${place.avgVisitHrs}h to see. Best time: ${place.bestTime}.`,
    `Fits budget tiers: ${(place.budgetTier || []).join(', ')}.`,
    `Guide note: ${place.desc || ''}`,
    ctx.tripNote ? `Traveller context: ${ctx.tripNote}` : '',
    'Write the read for this place.'
  ]
    .filter(Boolean)
    .join('\n')
}

/* ------------------------------------------------------------------- handler */

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  // tell the client whether a key exists at all, so the UI badge never lies
  if (body && body.fallback) body.hasKey = hasKey()
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 200000) {
        resolve(null)
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function narrate(req, res) {
  const body = await readBody(req)
  if (!body) return send(res, 200, { fallback: true, reason: 'bad-request' })

  const { kind = 'day', day, place, ctx = {} } = body

  // the UI badge asks this on load: "is there a key on the server?" — nothing else
  if (kind === 'probe') {
    const live = hasKey()
    return send(res, 200, {
      hasKey: live,
      provider: providerName(),
      reason: live ? 'ready' : 'no-api-key',
      fallback: !live
    })
  }
  const prompt = kind === 'place' ? (place ? placePrompt(place, ctx) : '') : day ? dayPrompt(day, ctx) : ''
  if (!prompt) return send(res, 200, { fallback: true, reason: 'nothing-to-narrate' })
  if (!hasKey()) return send(res, 200, { fallback: true, reason: 'no-api-key' })

  const result = await callProvider({ kind, prompt })
  const text = (result.text || '').replace(/\s*\n\s*/g, '\n').trim()

  if (result.error || !text) {
    return send(res, 200, { fallback: true, reason: result.error || 'empty-response' })
  }
  // a sane guard: the model is only ever allowed to colour the plan, not replace it
  if (text.length < 40 || text.length > 1600) {
    return send(res, 200, { fallback: true, reason: 'response-out-of-range' })
  }
  return send(res, 200, { narration: text, provider: result.provider, cached: false })
}

export function createNarrateHandler() {
  return (req, res) => {
    narrate(req, res).catch(() => send(res, 200, { fallback: true, reason: 'handler-error' }))
  }
}

export default narrate
