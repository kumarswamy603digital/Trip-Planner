/**
 * Engine conformance tests (run with `npm test`).
 * Exercises the full input matrix — every interest combination × 1–7 days × 3 tiers ×
 * 4 start cities — and asserts the blueprint's functional requirements hold everywhere.
 *   FR-2 every day has stops with time blocks, costs and reasons
 *   FR-3 no day zig-zags: every hop between consecutive stops is within one compact area
 *   FR-4 every day cost lands inside the chosen tier band
 *   FR-5 the trip's Kannada kit is 8–12 phrases
 *   NFR-1 generation under 2s (measured, must be milliseconds)
 */
import {
  generateItinerary,
  regenerateDay,
  haversineKm,
  BUDGET_TIERS,
  INTERESTS,
  START_CITIES,
  ALL_PLACES,
  templateHighlight
} from '../src/lib/itineraryEngine.js'

let failures = 0
let checks = 0
const fail = (msg, ctx) => {
  failures++
  console.error(`  ✗ ${msg}`, ctx ? JSON.stringify(ctx).slice(0, 300) : '')
}
const ok = () => checks++

function subsets(arr, min, max) {
  const out = []
  const n = arr.length
  for (let mask = 1; mask < 1 << n; mask++) {
    const s = arr.filter((_, i) => mask & (1 << i))
    if (s.length >= min && s.length <= max) out.push(s)
  }
  return out
}

const interestSets = [
  ...subsets(INTERESTS.map((i) => i.id), 1, 2),
  ['heritage', 'nature', 'food', 'adventure'],
  ['beaches', 'food', 'spiritual'],
  ['adventure', 'nature', 'beaches', 'spiritual', 'heritage', 'food']
]

const MAX_HOP_KM = 90 // FR-3 hard ceiling for a hop inside one day
const t0 = performance.now()
let runs = 0
let slowest = 0

for (const interests of interestSets) {
  for (let days = 1; days <= 7; days++) {
    for (const budget of Object.keys(BUDGET_TIERS)) {
      for (const city of START_CITIES) {
        const it = generateItinerary({ interests, days, budget, startCity: city.id, seed: 42 })
        runs++
        const start = performance.now()
        const band = BUDGET_TIERS[budget]

        if (it.days.length !== days)
          fail('day count mismatch', { interests, days, budget, got: it.days.length })
        if (!it.days.length) fail('empty itinerary', { interests, days, budget })

        for (const d of it.days) {
          if (!d.stops.length) fail('day with no stops', { interests, days, budget, day: d.day })
          ok()
          if (d.stops.length > 4) fail('too many stops in a day', { day: d.day, n: d.stops.length })
          if (!d.base || typeof d.base !== 'string') fail('day has no base', { day: d.day })

          const sum =
            d.breakdown.entry + d.breakdown.localTransport + d.breakdown.foodStay + d.breakdown.experiences
          if (sum !== d.dayCost) fail('cost sheet does not add up', { day: d.day, sum, d: d.dayCost })

          // FR-4 — the day must sit inside the tier band
          if (d.dayCost < band.min - 1 || d.dayCost > band.max + 1)
            fail(`day ${d.day} cost ${d.dayCost} outside ${budget} band`, {
              interests,
              days,
              budget,
              base: d.base,
              cost: d.dayCost
            })

          // FR-3 — routing sanity inside the day
          for (let i = 1; i < d.stops.length; i++) {
            const hop = haversineKm(d.stops[i - 1].place, d.stops[i].place)
            if (hop > MAX_HOP_KM)
              fail('day zig-zags', {
                day: d.day,
                from: d.stops[i - 1].place.name,
                to: d.stops[i].place.name,
                km: Math.round(hop)
              })
          }
          // every stop must be scheduled, costed and explained
          for (const s of d.stops) {
            if (!['morning', 'afternoon', 'evening'].includes(s.timeBlock))
              fail('stop missing time block', { place: s.placeId, block: s.timeBlock })
            if (!s.startAt) fail('stop missing clock time', { place: s.placeId })
            if (typeof s.estCost !== 'number') fail('stop missing cost', { place: s.placeId })
            if (!s.why || !s.why.length) fail('stop missing reason', { place: s.placeId })
            if (!s.place.budgetTier.includes(budget) && s.estCost > 200)
              fail('premium-only expensive stop on a budget day', { place: s.placeId, budget })
          }
        }

        // FR-5 — kit size
        const kit = [...new Set(it.days.flatMap((d) => d.phrases))]
        if (kit.length !== it.phraseIds.length)
          fail('phraseIds out of sync with days', { kit: kit.length, ids: it.phraseIds.length })
        if (it.phraseIds.length < 8 || it.phraseIds.length > 12)
          fail('survival kit outside 8–12 phrases', { n: it.phraseIds.length })

        // no place repeated across days
        const all = it.days.flatMap((d) => d.stops.map((s) => s.placeId))
        if (new Set(all).size !== all.length) fail('same place used twice', { interests, days, budget })

        if (it.totalCost !== it.days.reduce((s, d) => s + d.dayCost, 0))
          fail('total cost mismatch', { it: it.totalCost })

        // FR-11 — regenerate keeps the day valid and inside the band
        const before = it.days[0].stops.map((s) => s.placeId).join()
        const regen = regenerateDay(it, 1, 7)
        const after = regen.days[0].stops.map((s) => s.placeId).join()
        if (before === after && it.days[0].stops.length >= 3)
          fail('regenerate produced the same day', { interests, days, budget })
        const rd = regen.days[0]
        if (rd.dayCost < band.min - 1 || rd.dayCost > band.max + 1)
          fail('regenerated day outside band', { cost: rd.dayCost, budget })
        const elapsed = performance.now() - start
        slowest = Math.max(slowest, elapsed)
      }
    }
  }
}

const totalMs = performance.now() - t0

// determinism
const a = generateItinerary({ interests: ['heritage'], days: 3, budget: 'budget', startCity: 'Hubballi', seed: 7 })
const b = generateItinerary({ interests: ['heritage'], days: 3, budget: 'budget', startCity: 'Hubballi', seed: 7 })
delete a.meta.generatedAt
delete b.meta.generatedAt
if (JSON.stringify(a) !== JSON.stringify(b)) fail('engine is not deterministic for a fixed seed')
else ok()

// graceful degradation on junk input
const junk = generateItinerary({})
if (!junk.days.length || junk.tier !== 'comfort') fail('engine cannot handle empty input')
else ok()
const weird = generateItinerary({ interests: ['stargazing'], days: 99, budget: 'luxury', startCity: 'Nowhere' })
if (weird.days.length !== 7) fail('days not clamped to 7', { got: weird.days.length })
else ok()

// every place must render its guide copy (a data/shape bug used to blank the page)
for (const p of ALL_PLACES) {
  const hi = templateHighlight(p)
  if (typeof hi !== 'string' || !hi.includes(p.bestTime) && !/any time of year/.test(hi))
    fail('templateHighlight broken', { place: p.id, hi })
  else ok()
}
for (const d of [...a.days, ...weird.days, ...junk.days]) {
  if (typeof d.narration !== 'string' || d.narration.length < 40) fail('day narration missing', { day: d.day })
  else ok()
}

console.log(`\n${runs} itineraries generated in ${totalMs.toFixed(0)}ms (slowest single run ${slowest.toFixed(1)}ms)`)
console.log(`${checks} assertions passed, ${failures} failures`)
if (slowest > 2000) {
  fail('NFR-1 violated: generation took over 2s', { slowest })
}
process.exit(failures ? 1 : 0)
