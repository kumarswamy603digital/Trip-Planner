/**
 * NammaYatri AI — ItineraryEngine
 * 100% deterministic (no network, no AI). It never fails live: the LLM narration is an
 * enhancement layered on top of the plan this file produces.
 *
 * Pipeline (Part D of the build blueprint):
 *   1. filter + score places by interest / popularity / tier-fit / proximity to start city
 *   2. group them into compact geographic units (region ▸ sub-region)
 *   3. pick a feasible sequence of units for `days`, so a day never zig-zags across the state
 *   4. simulate a real day schedule (travel legs, visit hours, lunch) and assign
 *      morning / afternoon / evening blocks
 *   5. cost the day and force it inside the chosen budget band by swapping cheaper
 *      same-region alternates, then re-fitting the flexible lines
 *   6. attach the Kannada phrases that day actually needs
 */
import PLACES from '../data/places.json' with { type: 'json' }
import PHRASES from '../data/phrases.json' with { type: 'json' }

/* ---------------------------------------------------------------- constants */

export const INTERESTS = [
  { id: 'heritage', label: 'Heritage & temples', kannada: 'ಪರಂಪರೆ', emoji: '🏛️' },
  { id: 'nature', label: 'Nature & hills', kannada: 'ಪ್ರಕೃತಿ', emoji: '🌿' },
  { id: 'food', label: 'Food & markets', kannada: 'ಊಟ', emoji: '🍛' },
  { id: 'beaches', label: 'Beaches', kannada: 'ಕಡಲತೀರ', emoji: '🌊' },
  { id: 'adventure', label: 'Adventure & treks', kannada: 'ಸಾಹಸ', emoji: '🧗' },
  { id: 'spiritual', label: 'Spiritual', kannada: 'ದೇವಸ್ಥಾನ', emoji: '🪔' }
]

export const BUDGET_TIERS = {
  budget: { min: 1000, max: 2000, label: 'Budget', perDay: '₹1,000–2,000' },
  comfort: { min: 2000, max: 4500, label: 'Comfort', perDay: '₹2,000–4,500' },
  premium: { min: 4500, max: 9000, label: 'Premium', perDay: '₹4,500–9,000' }
}

export const START_CITIES = [
  { id: 'Bengaluru', kannada: 'ಬೆಂಗಳೂರು', lat: 12.9716, lng: 77.5946 },
  { id: 'Mysuru', kannada: 'ಮೈಸೂರು', lat: 12.2958, lng: 76.6393 },
  { id: 'Hubballi', kannada: 'ಧಾರವಾಡ', lat: 15.3647, lng: 75.1240 },
  { id: 'Mangaluru', kannada: 'ಮಂಗಳೂರು', lat: 12.9141, lng: 74.8560 }
]

/** Which Kannada phrase tags each interest/activity type needs on the ground. */
export const CATEGORY_TAGS = {
  heritage: ['market', 'directions', 'greeting'],
  nature: ['directions', 'transport', 'greeting'],
  food: ['food', 'market', 'greeting'],
  beaches: ['food', 'directions', 'emergency'],
  adventure: ['transport', 'directions', 'emergency'],
  spiritual: ['temple', 'greeting', 'food']
}

/** Flexible spend assumption per traveller per day (stay share + meals). */
const FOOD_STAY = { budget: 700, comfort: 1900, premium: 4200 }
/** Local transport, ₹ per km per person (shared bus-auto / cab split three / private cab). */
const TRANSPORT_RATE = { budget: 4, comfort: 7, premium: 18 }
/** Guide, permits, experiences add-on per day. */
const EXPERIENCE = { budget: 0, comfort: 300, premium: 900 }
/** Honest floors — the engine never pretends a meal is free. */
const FLOORS = { food: 400, transport: 120, experience: 0 }
/** Per-day transport ceiling: a budget traveller takes the KSRTC bus on a long leg, not a cab. */
const TRANSPORT_CAP = { budget: 600, comfort: 1600, premium: 3200 }
/** Entry ticket a traveller at this tier should ever be handed on a normal day. */
const MAX_ENTRY = { budget: 200, comfort: 600, premium: 2000 }
/** Where spare money goes when a day comes in under the band (food / local hire / guide). */
const GROW_SPLIT = {
  budget: { food: 0.7, transport: 0.3, experiences: 0 },
  comfort: { food: 0.6, transport: 0.1, experiences: 0.3 },
  premium: { food: 0.45, transport: 0.15, experiences: 0.4 }
}

const DAY_START = 7.5 // 07:30
const DAY_END = 19.0 // 19:00 latest last stop
const MAX_STOPS = 4
const MAX_STOP_HOP_KM = 70 // routing sanity: never pair stops further apart than this
const LONG_HAUL_KMH = 52
const CITY_KMH = 34

const REASONS = {
  heritage: [
    'a thousand years of workmanship you can stand next to',
    'the kind of stonework that rewrites what you thought was possible by hand',
    'the best-preserved record of the dynasty that built Karnataka',
    'less crowded than the postcards, better in person'
  ],
  spiritual: [
    'still a working temple, not a monument — you arrive into a living ritual',
    'the smell of camphor and a thousand years of the same chant',
    'one of those places where the architecture is the theology',
    'free darshan, free prasade, and the quietest hour of your day'
  ],
  nature: [
    'the green changes colour every hundred metres on the way in',
    'best at first light, when the mist sits in the valley and nobody else is there',
    'a genuine break from the city — cool air, clean water, birdsong',
    'photographs never carry the sound of this place'
  ],
  food: [
    'the local plate here is the reason people detour two hundred kilometres',
    'banana leaf, three chutneys and a plate you will think about for a week',
    'where the region actually eats, not where tourists are pointed',
    'cheaper than a city café and ten times more memorable'
  ],
  beaches: [
    'clean sand, no jet skis in the bay, and a sunset you can plan a whole evening around',
    'the Arabian Sea at its calmest — swim before four, stay for the light',
    'a headland walk connects this to the next bay; do it at golden hour',
    'the fishing harbour next door is the real show'
  ],
  adventure: [
    'a real climb with a real view — start early, the light is the reward',
    'the kind of effort that makes the lunch afterwards taste legendary',
    'go with a local guide and you will see things the maps miss',
    'the best three hours of the trip, and the only ones you will retell'
  ]
}

/* ---------------------------------------------------------------- geometry */

export function haversineKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Road time estimate — hill/coast roads are slower than highways, plus a boarding buffer. */
export function travelHours(km) {
  if (km <= 0.4) return 0
  const speed = km > 150 ? LONG_HAUL_KMH : km > 40 ? 42 : CITY_KMH
  const buffer = km > 150 ? 0.6 : km > 40 ? 0.3 : 0.1
  return km / speed + buffer
}

function centroid(points) {
  const n = points.length || 1
  return points.reduce(
    (c, p) => ({ lat: c.lat + p.lat / n, lng: c.lng + p.lng / n }),
    { lat: 0, lng: 0 }
  )
}

/** Tiny seeded PRNG so "regenerate" is reproducible per seed but still varied. */
function makeRandom(seed) {
  let s = (seed || 1) * 1664525 + 1013904223
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/* ---------------------------------------------------------------- scoring */

function interestOverlap(place, interests) {
  if (!interests.length) return 0
  const hits = place.category.filter((c) => interests.includes(c)).length
  if (!hits) return 0
  return hits / Math.max(1, place.category.length) * 0.6 + hits * 0.4
}

function scorePlace(place, { interests, tier, start }) {
  const overlap = interestOverlap(place, interests)
  let score = 0
  score += overlap * 26 // interest match dominates
  score += place.popularity * 1.9 // popularity 1–10
  score += place.budgetTier.includes(tier) ? 8 : -22 // tier fit
  const km = start ? haversineKm(start, place) : 0
  score += Math.max(0, 14 - km / 26) // proximity to where the traveller starts
  score -= Math.max(0, place.avgVisitHrs - 4) * 1.5 // very long visits eat a whole day
  if (place.entryCost > 900 && tier === 'budget') score -= 20
  return { place, score, overlap, distanceFromStart: km }
}

/* ---------------------------------------------------------------- clustering */

/**
 * A "unit" is one compact area a single day can cover (e.g. Hampi Village, Gokarna,
 * Madikeri). Stops are grouped by sub-region inside a macro region, so a day never has
 * to jump 200 km. Units with only one candidate place are merged into the closest
 * neighbour unit of the same macro region.
 */
function buildUnits(scored) {
  const byKey = new Map()
  for (const s of scored) {
    const key = `${s.place.region}▸${s.place.subRegion}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(s)
  }
  let units = [...byKey.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => b.score - a.score)
    const c = centroid(sorted.map((s) => s.place))
    return {
      key,
      region: sorted[0].place.region,
      name: sorted[0].place.subRegion,
      places: sorted,
      centroid: c,
      bestScore: sorted[0].score,
      supplyScore: sorted.slice(0, 4).reduce((sum, s) => sum + s.score, 0) / 4
    }
  })

  // merge singleton units into the nearest sibling unit of the same region
  const multi = units.filter((u) => u.places.length >= 2)
  if (!multi.length) return units
  const merged = new Map(multi.map((u) => [u.key, { ...u, places: [...u.places] }]))
  for (const u of units.filter((x) => x.places.length < 2)) {
    if (!merged.size) break
    let target = null
    let bestD = Infinity
    for (const cand of merged.values()) {
      const d = haversineKm(u.centroid, cand.centroid)
      if (cand.region === u.region && d < bestD) {
        bestD = d
        target = cand
      }
    }
    if (!target) target = [...merged.values()][0]
    target.places.push(...u.places)
    target.centroid = centroid(target.places.map((s) => s.place))
    target.supplyScore = target.places.slice(0, 4).reduce((s, x) => s + x.score, 0) / 4
  }
  return [...merged.values()]
}

function pickUnits(units, days, start) {
  // How many macro regions can a trip of this length honestly cover?
  const maxRegions = days <= 1 ? 1 : days <= 3 ? 2 : days <= 5 ? 3 : 4
  const regions = new Map()
  for (const u of units) {
    if (!regions.has(u.region)) regions.set(u.region, [])
    regions.get(u.region).push(u)
  }
  const regionRank = [...regions.entries()]
    .map(([name, us]) => {
      const top = us.reduce((m, u) => Math.max(m, u.bestScore), -Infinity)
      const supply = us.reduce((s, u) => s + u.places.length, 0)
      const dist = haversineKm(start, centroid(us.map((u) => u.centroid)))
      return { name, us, top, supply, dist, value: top + supply * 1.1 - dist / 30 }
    })
    .sort((a, b) => b.value - a.value)

  const chosen = []
  let remaining = days
  for (const r of regionRank) {
    if (remaining <= 0) break
    if (chosen.length >= maxRegions) break
    const want = Math.min(remaining, r.us.length, days <= 2 ? 2 : 3)
    if (want < 1) continue
    chosen.push({ ...r, take: want })
    remaining -= want
  }
  // If the ranks were too thin, top up from the strongest region's leftovers.
  if (remaining > 0 && chosen.length) {
    chosen.sort((a, b) => b.us.length - a.us.length)
    chosen[0].take += remaining
    remaining = 0
  }
  if (!chosen.length) return { primary: [], spares: [] }

  // Order regions as a chain from the start city, then lay days down the chain.
  const ordered = []
  let cursor = start
  const pool = [...chosen]
  while (pool.length) {
    pool.sort(
      (a, b) =>
        haversineKm(cursor, centroid(a.us.map((u) => u.centroid))) -
        haversineKm(cursor, centroid(b.us.map((u) => u.centroid)))
    )
    const next = pool.shift()
    ordered.push(next)
    cursor = centroid(next.us.map((u) => u.centroid))
  }

  // Within each region, take its best units, then order units by the same chain rule.
  const plan = []
  let cursorUnit = null
  for (const r of ordered) {
    const sortedUnits = [...r.us].sort((a, b) => b.supplyScore - a.supplyScore)
    const take = Math.max(1, Math.min(sortedUnits.length, r.take))
    let selected = sortedUnits.slice(0, take)
    if (cursorUnit) {
      const first = selected.reduce(
        (m, u) => (haversineKm(cursorUnit.centroid, u.centroid) < haversineKm(cursorUnit.centroid, m.centroid) ? u : m),
        selected[0]
      )
      selected = [first, ...selected.filter((u) => u !== first)]
    }
    plan.push(...selected.map((u) => ({ unit: u, region: r.name })))
    cursorUnit = selected[selected.length - 1]
  }

  // Finally: one day per unit in chain order, plus every remaining unit as a spare so a
  // long trip can keep going without ever repeating a place the traveller has already seen.
  const primary = plan.slice(0, Math.max(days, plan.length))
  const spares = units
    .filter((u) => !plan.some((p) => p.unit === u))
    .sort((a, b) => b.supplyScore - a.supplyScore)
    .map((u) => ({ unit: u, region: u.region }))
  return { primary, spares }
}

/* ---------------------------------------------------------------- schedule */

function orderStops(places, entry) {
  const rest = [...places]
  const route = []
  let cursor = entry ? { lat: entry.lat, lng: entry.lng } : rest[0].place
  while (rest.length && route.length < MAX_STOPS) {
    rest.sort(
      (a, b) =>
        b.score + haversineKm(cursor, a.place) / 12 - (a.score + haversineKm(cursor, b.place) / 12)
    )
    // nearest neighbour, but never accept a hop that breaks the day's geography
    let pickIdx = -1
    let bestHop = Infinity
    for (let i = 0; i < rest.length; i++) {
      const hop = haversineKm(cursor, rest[i].place)
      if (hop <= MAX_STOP_HOP_KM && hop < bestHop) {
        bestHop = hop
        pickIdx = i
      }
    }
    if (pickIdx === -1) break
    const picked = rest.splice(pickIdx, 1)[0]
    route.push(picked)
    cursor = picked.place
  }
  return route
}

function blockFor(hour) {
  if (hour < 12) return 'morning'
  if (hour < 16) return 'afternoon'
  return 'evening'
}

function clock(hour) {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

function buildDay(dayNumber, unit, { tier, prevBase, usedIds, random }) {
  const start = prevBase || unit.centroid
  const legKm = Math.round(haversineKm(start, unit.centroid))
  const legHours = travelHours(legKm)

  // an area the traveller has already walked end to end cannot fill another day
  const unseen = unit.places.filter((s) => !usedIds.has(s.place.id))
  // and a day at this tier never carries a ticket priced for a richer traveller
  let pool = unseen.filter((s) => tierFits(s.place, tier))
  if (pool.length < 2) pool = unseen.filter((s) => s.place.entryCost <= MAX_ENTRY[tier])
  if (!pool.length) return { day: dayNumber, base: unit.name, region: unit.region, stops: [] }
  const maxByTravel = legHours > 4 ? 2 : legHours > 2.5 ? 3 : MAX_STOPS
  const entryPoint = pool[0].place
  const ordered = orderStops(pool, entryPoint).slice(0, maxByTravel)

  // walk the clock: travel leg, then each hop + visit, with a lunch break
  let t = legHours > 0.8 ? Math.max(6.5, DAY_START - Math.min(1, legHours - 0.8)) : DAY_START
  if (legHours > 0.8) t = 6.5 + legHours
  const stops = []
  let cursor = { lat: entryPoint.lat, lng: entryPoint.lng }
  for (const s of ordered) {
    const hop = Math.round(haversineKm(cursor, s.place))
    const hopH = travelHours(hop)
    if (t + hopH + s.place.avgVisitHrs > DAY_END) break
    if (t < 12.3 && t + hopH > 12.3) t = Math.max(t + hopH, 13.0) // lunch
    else if (t > 12.3 && t < 13.0 && stops.length) t = 13.0
    const arrive = t + hopH
    const block = blockFor(arrive)
    stops.push({
      placeId: s.place.id,
      place: s.place,
      timeBlock: block,
      startAt: clock(arrive),
      durationHrs: s.place.avgVisitHrs,
      hopKm: hop,
      estCost: s.place.entryCost,
      why: reasonFor(s.place, random)
    })
    t = arrive + s.place.avgVisitHrs
    cursor = { lat: s.place.lat, lng: s.place.lng }
  }

  // ---- FR-4 budget fit: price the day, then force it inside the band honestly
  const band = BUDGET_TIERS[tier]
  let entryTotal = stops.reduce((s, x) => s + x.estCost, 0)
  let driven = legKm + stops.reduce((s, x) => s + x.hopKm, 0)
  let transport = transportFor(driven, tier)
  let cost = fitDayCost(entryTotal, transport, tier, band)

  // Still over the ceiling? Give up the priciest stop — first for a cheaper alternate from
  // the same pocket of the map, and only if there is none, for nothing at all.
  let guard = 0
  while (cost.total > band.max && stops.length > 1 && guard++ < 8) {
    const pricey = [...stops].sort((a, b) => b.estCost - a.estCost)[0]
    const at = stops.indexOf(pricey)
    const cheaper = unit.places.find(
      (p) =>
        p.place.entryCost < pricey.estCost &&
        p.place.entryCost <= MAX_ENTRY[tier] &&
        !usedIds.has(p.place.id) &&
        !stops.some((s) => s.placeId === p.place.id) &&
        haversineKm(pricey.place, p.place) <= MAX_STOP_HOP_KM
    )
    if (cheaper) {
      const hop = Math.round(haversineKm(at > 0 ? stops[at - 1].place : pricey.place, cheaper.place))
      stops[at] = makeStop(cheaper, 15, hop, random)
      entryTotal = stops.reduce((s, x) => s + x.estCost, 0)
    } else {
      stops.splice(at, 1)
      entryTotal = stops.reduce((s, x) => s + x.estCost, 0)
    }
    driven = legKm + stops.reduce((s, x) => s + x.hopKm, 0)
    transport = transportFor(driven, tier)
    cost = fitDayCost(entryTotal, transport, tier, band)
  }

  return {
    day: dayNumber,
    base: unit.name,
    region: unit.region,
    travelLeg: {
      from: prevBase ? 'previous base' : unit.name,
      km: legKm,
      hours: Number(legHours.toFixed(1)),
      note: legNote(legKm, unit.region)
    },
    stops,
    breakdown: {
      entry: entryTotal,
      localTransport: cost.transport,
      foodStay: cost.flexible,
      experiences: cost.experiences
    },
    dayCost: cost.total,
    distanceKm: driven,
    phrases: [],
    gettingAround: gettingAroundFor(unit.region),
    narration: ''
  }
}

/** Local transport for a day of driving — ₹/km by tier, rounded, capped. */
function transportFor(km, tier) {
  const raw = Math.round((km * TRANSPORT_RATE[tier]) / 40) * 40
  return Math.max(FLOORS.transport, Math.min(TRANSPORT_CAP[tier], raw))
}

/**
 * Fit the flexible lines so entry + transport + food + experiences lands inside the band.
 * The number returned is the number displayed: the cost sheet always adds up.
 */
function fitDayCost(entryTotal, transport, tier, band) {
  const floorMin = band.min + Math.round(band.min * 0.06)
  const ceilMax = band.max - Math.round(band.max * 0.04)
  let tr = transport
  let flexible = FOOD_STAY[tier]
  let experiences = EXPERIENCE[tier]
  let total = entryTotal + tr + flexible + experiences

  if (total > ceilMax) {
    // trim the discretionary lines first, never below their honest floors
    let over = total - ceilMax
    const cutExp = Math.min(over, Math.max(0, experiences - FLOORS.experience))
    experiences -= cutExp
    over -= cutExp
    const cutFood = Math.min(over, Math.max(0, flexible - FLOORS.food))
    flexible -= cutFood
    over -= cutFood
    const cutTr = Math.min(over, Math.max(0, tr - FLOORS.transport))
    tr -= cutTr
    total = entryTotal + tr + flexible + experiences
  } else if (total < floorMin) {
    const gap = floorMin - total
    const split = GROW_SPLIT[tier]
    flexible += Math.round(gap * split.food)
    tr += Math.round(gap * split.transport)
    experiences += Math.round(gap * split.experiences)
    total = entryTotal + tr + flexible + experiences
  }
  return { transport: tr, flexible, experiences, total }
}

function makeStop(scored, hour, hopKm, random) {
  return {
    placeId: scored.place.id,
    place: scored.place,
    timeBlock: blockFor(hour),
    startAt: clock(hour),
    durationHrs: scored.place.avgVisitHrs,
    hopKm,
    estCost: scored.place.entryCost,
    why: reasonFor(scored.place, random)
  }
}

/** Free or nearly-free spots suit every wallet; otherwise a place must list the tier. */
function tierFits(place, tier) {
  return place.budgetTier.includes(tier) || place.entryCost <= 100
}

function reasonFor(place, random) {
  const primary = place.category[0]
  const list = REASONS[primary] || REASONS.heritage
  const idx = Math.floor((random ? random() : place.popularity / 11) * list.length) % list.length
  return `Why you'll love this: ${list[idx]}`
}

function legNote(km, region) {
  if (km < 8) return `Everything today sits inside ${region} — a short hop between stops.`
  if (km < 60) return `${km} km of easy driving into the ${region} day-base.`
  if (km < 180) return `${km} km — leave early, breakfast on the way, first stop by late morning.`
  return `${km} km today (about ${Math.round(km / 45)}h). It is the one long haul of the trip — worth it.`
}

function gettingAroundFor(region) {
  const map = {
    Bengaluru: 'Namma Metro + a prepaid auto for the last mile; KSRTC for Nandi Hills.',
    Mysuru: 'City buses cover the palace circuit; hire an auto for the day to Somnathapura.',
    Coorg: 'Hire one cab for the whole loop from Madikeri — the ghat roads make self-driving slow.',
    Chikkamagaluru: 'Cab from Chikkamagaluru town; Hebbe Falls needs the forest-department jeep.',
    Hampi: 'Walk and cycle the site; auto or the ₹10 shakti template bus for the far group.',
    'Badami-Pattadakal': 'Autos from Badami town; hire a day cab for Pattadakal and Aihole.',
    'Belur-Halebidu': 'Buses from Hassan; a shared auto links Belur and Halebidu in 40 minutes.',
    'Shivamogga-Ghats': 'Bus to Jog Falls, then the ST jeep down the ghat; keep a day cab at Sakleshpur.',
    'Coastal Karnataka': 'KSRTC coastal buses run everything; ferries at Malpe and Honnavar by daylight.',
    Bandipur: 'Drive or hire from Mysuru; safari gypsies are booked at the reserve gate.'
  }
  return map[region] || 'Hire a cab for the day — it is the cheapest way to see three stops.'
}

/* ---------------------------------------------------------------- phrases */

const CORE_TAGS = ['greeting', 'directions', 'transport', 'emergency']

function attachPhrases(days, interests, tier) {
  const byId = new Map(PHRASES.map((p) => [p.id, p]))
  const tagNeed = new Map()
  const bump = (tag, weight) => tagNeed.set(tag, (tagNeed.get(tag) || 0) + weight)

  interests.forEach((c) => (CATEGORY_TAGS[c] || []).forEach((t) => bump(t, 3)))
  CORE_TAGS.forEach((t) => bump(t, 1))

  const used = new Set()
  const tripPhrases = []
  const pickFor = (tags, count) => {
    const ranked = PHRASES.filter((p) => !used.has(p.id)).sort((a, b) => {
      const sa = a.tags.reduce((s, t) => s + (tagNeed.get(t) || 0), 0)
      const sb = b.tags.reduce((s, t) => s + (tagNeed.get(t) || 0), 0)
      return sb - sa
    })
    const out = []
    for (const p of ranked) {
      if (out.length >= count) break
      if (!tags || !tags.length || p.tags.some((t) => tags.includes(t))) {
        out.push(p.id)
        used.add(p.id)
      }
    }
    return out
  }

  for (const day of days) {
    const cats = new Set()
    day.stops.forEach((s) => s.place.category.forEach((c) => cats.add(c)))
    const tags = new Set()
    cats.forEach((c) => (CATEGORY_TAGS[c] || []).forEach((t) => tags.add(t)))
    CORE_TAGS.forEach((t) => tags.add(t))
    day.tags = [...tags]
    day.phrases = pickFor([...tags], day.stops.length >= 3 ? 4 : day.stops.length >= 2 ? 3 : 2)
    tripPhrases.push(...day.phrases)
  }

  // FR-5: the trip kit must land between 8 and 12 phrases
  let guard = 0
  while (tripPhrases.length < 8 && guard++ < 12) {
    const extra = pickFor(CORE_TAGS, 1)
    if (!extra.length) break
    const last = days[days.length - 1]
    last.phrases.push(...extra)
    tripPhrases.push(...extra)
  }
  if (tripPhrases.length > 12) {
    const cut = tripPhrases.slice(12)
    for (const day of days) day.phrases = day.phrases.filter((id) => !cut.includes(id))
    days.forEach((d) => (d.tags = [...new Set(d.phrases.map((id) => byId.get(id)?.tags).flat())]))
  }
  return [...new Set(tripPhrases)].slice(0, 12)
}

/* ---------------------------------------------------------------- template narrator */

/**
 * The built-in local-guide voice. Same structure the LLM produces, so the UI is
 * identical with or without an API key (FR-8, NFR-5).
 */
export function templateNarration(day, ctx = {}) {
  const cats = [...new Set(day.stops.map((s) => s.place.category).flat())]
  const names = day.stops.map((s) => s.place.name)
  const lead =
    cats.find((c) => c === 'heritage') || cats.find((c) => c === 'spiritual') || cats[0] || 'nature'
  const colour = {
    heritage: 'stone that has been keeping its own schedule for a thousand years',
    spiritual: 'temple bells over the lane before the traffic wakes up',
    nature: 'the kind of green that makes the last two hours of driving worth it',
    food: 'a banana leaf and a plate that arrives faster than you can ask for it',
    beaches: 'salt air and a horizon with nothing in it',
    adventure: 'an early start, a steep bit, and then the view'
  }[lead]
  if (!names.length) return `Day ${day.day} keeps it easy around ${day.base}.`
  const first = day.stops[0].place
  const second = names[1]
  const tail = day.stops.length > 2 ? ` and one more stop before dark` : ``
  const longLeg = day.travelLeg && day.travelLeg.km > 150
  return `${longLeg ? `You roll into ${day.base} by late morning — ` : `Day ${day.day} belongs to ${day.base} — `}${first.name} first, while it is still ${colour}${second ? `, then ${second}` : ''}${tail}. Budget about ₹${day.dayCost.toLocaleString('en-IN')} and keep the phrasebook open; ${day.base} speaks Kannada first and English second.`
}

export function templateHighlight(place) {
  const list = REASONS[place.category[0]] || REASONS.heritage
  const line = list[(place.popularity || 1) % list.length]
  const when = /round/i.test(place.bestTime) ? 'Good any time of year' : `Best in ${place.bestTime}`
  return `Worth it for ${line.replace(/\.$/, '')}. ${when}, and it wants about ${place.avgVisitHrs}h of your day.`
}

/* ---------------------------------------------------------------- main */

export function generateItinerary(input = {}) {
  const interests = (input.interests || []).filter((i) => INTERESTS.some((x) => x.id === i))
  const days = Math.min(7, Math.max(1, Number(input.days) || 2))
  const tier = BUDGET_TIERS[input.budget] ? input.budget : 'comfort'
  const startCity = START_CITIES.find((c) => c.id === input.startCity) || START_CITIES[0]
  const seed = input.seed || Math.floor(Date.now() / 1000) % 100000
  const random = makeRandom(seed)

  const scoredAll = PLACES.map((p) => scorePlace(p, { interests, tier, start: startCity }))
  // Never let a thin interest filter starve the engine: keep the strongest 60 either way.
  let candidates = scoredAll.filter((s) => s.overlap > 0)
  if (candidates.length < 14) {
    candidates = [...scoredAll].sort((a, b) => b.score - a.score).slice(0, 60)
  } else {
    candidates = [...candidates].sort((a, b) => b.score - a.score).slice(0, 60)
  }

  const units = buildUnits(candidates)
  const picked = pickUnits(units, days, startCity)
  const queue = [...picked.primary, ...picked.spares]

  const usedIds = new Set()
  const out = []
  let prevBase = { lat: startCity.lat, lng: startCity.lng }
  let safety = 0
  while (out.length < days && safety++ < 60) {
    let next = queue.shift()
    if (!next) {
      // thin interest filter: regroup whatever is still unseen into fresh day units
      const leftover = scoredAll
        .filter((s) => !usedIds.has(s.place.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 40)
      const fresh = buildUnits(leftover).map((u) => ({ unit: u, region: u.region }))
      if (!fresh.length) break
      queue.push(...fresh)
      continue
    }
    if (next.unit.places.every((s) => usedIds.has(s.place.id))) continue
    const day = buildDay(out.length + 1, next.unit, { tier, prevBase, usedIds, random })
    if (!day.stops.length) continue
    day.stops.forEach((s) => usedIds.add(s.placeId))
    prevBase = centroid(day.stops.map((s) => s.place))
    day.regionName = next.region
    out.push(day)
  }

  const phraseIds = attachPhrases(out, interests.length ? interests : ['heritage'], tier)
  out.forEach((d) => {
    d.narration = templateNarration(d)
  })

  const totalCost = out.reduce((s, d) => s + d.dayCost, 0)
  return {
    tripId: `ny-${seed.toString(36)}-${out.length}d`,
    startCity: startCity.id,
    startCityCoords: { lat: startCity.lat, lng: startCity.lng },
    tier,
    tierLabel: BUDGET_TIERS[tier].label,
    interests: interests.length ? interests : ['heritage'],
    dayCount: out.length,
    days: out,
    totalCost,
    phraseIds,
    regions: [...new Set(out.map((d) => d.region))],
    meta: {
      generatedAt: new Date().toISOString(),
      engine: 'deterministic-v1',
      placesConsidered: PLACES.length,
      seededFrom: seed
    }
  }
}

/** FR-11 — swap one day's stops for same-region alternates without touching the rest. */
export function regenerateDay(itinerary, dayNumber, seed) {
  const idx = itinerary.days.findIndex((d) => d.day === Number(dayNumber))
  if (idx === -1) return itinerary
  const old = itinerary.days[idx]
  const tier = itinerary.tier
  const usedElsewhere = new Set(
    itinerary.days.filter((d) => d.day !== old.day).flatMap((d) => d.stops.map((s) => s.placeId))
  )
  const random = makeRandom(seed || Math.floor(Math.random() * 100000))

  // rebuild the unit from every place in this region that the traveller has not used today
  const regionPlaces = PLACES.filter(
    (p) => p.region === old.region && !usedElsewhere.has(p.id)
  ).map((p) =>
    scorePlace(p, {
      interests: itinerary.interests,
      tier,
      start: { lat: old.stops[0]?.place.lat ?? 12.9, lng: old.stops[0]?.place.lng ?? 77.5 }
    })
  )
  const preferred = regionPlaces.filter((s) => s.overlap > 0)
  const poolSource = (preferred.length >= 3 ? preferred : regionPlaces).sort(
    (a, b) => b.score - a.score
  )
  const avoid = new Set(old.stops.map((s) => s.placeId))
  const fresh = poolSource.filter((s) => !avoid.has(s.place.id))
  const pool = fresh.length >= 2 ? fresh : poolSource

  const prev = idx > 0 ? itinerary.days[idx - 1] : null
  const prevBase = prev
    ? { lat: prev.stops[prev.stops.length - 1].place.lat, lng: prev.stops[prev.stops.length - 1].place.lng }
    : { lat: itinerary.startCityCoords.lat, lng: itinerary.startCityCoords.lng }

  // Retry with a fresh jitter until the traveller is handed a genuinely different day
  const beforeKey = old.stops.map((s) => s.placeId).join()
  let rebuilt = null
  for (let attempt = 0; attempt < 12 && !rebuilt; attempt++) {
    const source = attempt < 6 ? pool : poolSource
    const rnd = makeRandom((seed || 7) * 31 + attempt * 131)
    const jittered = source
      .map((s) => ({ s, v: s.score + (rnd() - 0.5) * 30 }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.s)
    if (!jittered.length) continue
    const unit = {
      key: old.region,
      region: old.region,
      name: jittered[0].place.subRegion,
      places: jittered,
      centroid: { lat: jittered[0].place.lat, lng: jittered[0].place.lng }
    }
    const cand = buildDay(old.day, unit, { tier, prevBase, usedIds: usedElsewhere, random: rnd })
    if (!cand.stops.length) continue
    if (cand.stops.map((s) => s.placeId).join() === beforeKey && attempt < 11) continue
    rebuilt = cand
  }
  if (!rebuilt) return itinerary
  rebuilt.tags = old.tags
  rebuilt.phrases = old.phrases
  rebuilt.base = old.base
  rebuilt.narration = templateNarration(rebuilt)

  const days = [...itinerary.days]
  days[idx] = rebuilt
  const totalCost = days.reduce((s, d) => s + d.dayCost, 0)
  return { ...itinerary, days, totalCost }
}

export function placeById(id) {
  return PLACES.find((p) => p.id === id) || null
}

export function phraseById(id) {
  return PHRASES.find((p) => p.id === id) || null
}

export function phrasesForTrip(itinerary) {
  const ids = itinerary && itinerary.phraseIds && itinerary.phraseIds.length
    ? itinerary.phraseIds
    : itinerary
      ? [...new Set((itinerary.days || []).flatMap((d) => d.phrases || []))]
      : []
  return ids.map((id) => phraseById(id)).filter(Boolean)
}

export const ALL_PLACES = PLACES
export const ALL_PHRASES = PHRASES
