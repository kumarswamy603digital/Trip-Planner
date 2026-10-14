# NammaYatri AI · ನಮ್ಮ ಯಾತ್ರಿ

**An AI travel planner for Karnataka that plans in milliseconds, works with the network off, and teaches you the Kannada you need on the day.**

Problem Statement 6 — Kannada Digital Innovation Hackathon.

> Live core: geography, timing, budget and language are computed locally by a deterministic engine. The LLM is an *enhancement* layered on top of a plan that is already correct. Kill the network, delete the API key, and every feature except the optional prose still works.

---

## 1. Why this exists

Most travel planners are search interfaces with a pretty calendar. They fail three specific things for Karnataka:

| What usually goes wrong | What NammaYatri does |
| --- | --- |
| A "day" asks you to see Hampi in the morning and Gokarna by evening — 400 km apart. | Every day is built inside **one compact area**. The engine refuses any hop over 70 km within a day. |
| Prices are aspirational and the budget slider is decoration. | Each day is costed from real entry tickets, distance-based local transport, and an honest food-and-stay band — then **forced inside the tier you chose**. |
| You arrive and cannot ask a single question. | Every day ships the **Kannada that day actually needs** — temple, auto, plate, bill — with romanisation and a listen button. |

## 2. Run it

```bash
npm install          # or: npm ci
npm run dev          # http://localhost:5173
npm test             # engine conformance suite — 2,016 itineraries, ~1 second
npm run build        # production bundle in dist/
npm run preview      # serve the built app on :4173
```

No API key is required to run anything. To switch on the optional AI prose:

```bash
copy .env.example .env      # then fill in ONE provider
```

`NARRATE_PROVIDER` picks the voice: `openai` (default), `anthropic` or `gemini`. Set that provider's key and its model. Dev reads `.env` directly; on Vercel the same values come from project environment variables.

## 3. The core loop

```
 4 answers ──▶ ItineraryEngine (local, deterministic) ──▶ day-by-day plan
    │                                                        │
    │              ┌── route map (Leaflet + OSM) ◀───────────┤
    │              ├── cost sheet (adds up, per day) ◀───────┤
 interests ◀───────┤                                          │
 days 1–7          ├── Kannada survival kit (8–12) ◀─────────┤
 budget tier       └── place guide pages ◀───────────────────┘
 start city
                       ┌─ with a key ─▶ POST /api/narrate ─▶ LLM prose
                       │                                       │
   template narration ─┴─ without ─▶ identical UI, same plan ◀─┘
```

**Regenerate this day** re-rolls a single day against the same region, budget and used-places set — the rest of the trip does not move.

## 4. The engine (`src/lib/itineraryEngine.js`)

Zero dependencies, zero network, ~1 ms per itinerary. Six stages:

1. **Score** every place — interest overlap (dominant), popularity, budget-tier fit, distance from the start city, and a penalty for visits that would eat the whole day.
2. **Cluster** into *units*: `region ▸ sub-region` (Hampi Village, Gokarna, Madikeri, Srirangapatna…). Singletons merge into the nearest sibling unit, so a day never has one candidate and nowhere to go.
3. **Select** units for `days` — macro regions are capped by trip length (1 day → 1 region, 7 days → 4), ranked by `best score + supply − distance`, then ordered as a **chain walking away from the start city** so the route does not criss-cross the state.
4. **Schedule** a real clock: 07:30 start, travel leg in, hop-to-hop driving time at ghat/coastal speeds (42–52 km/h) versus city speeds (34 km/h), a lunch break, a 19:00 hard stop, maximum 4 stops.
5. **Fit the budget** (`fitDayCost`): entry + transport + food-and-stay + guides. Over the ceiling → trim experiences, then flexible spend, then transport, down to honest floors (₹400 of food is never deleted), and if it is still too rich, swap in a cheaper alternate from the *same* area or give the stop up. Under the floor → spend the difference on the tier's local hire and good meals.
6. **Attach phrases** — the day's categories imply the tags you need on the ground, the kit is tuned to 8–12 phrases for the whole trip.

Seeded PRNG (`makeRandom`) makes "regenerate" varied but **reproducible for a given seed** — which is what makes it testable.

### Engine test suite

`npm test` runs `scripts/test-engine.mjs`: every interest subset × 1–7 days × 3 tiers × 4 start cities = **2,016 itineraries**, asserting FR-2/3/4/5/11 and NFR-1 on each one — stops scheduled, costed and explained; every consecutive hop within 90 km; cost sheet sums exactly to the day cost; day cost inside the band; kit between 8 and 12; no place used twice; regeneration changes the day and stays in band; junk input degrades to defaults.

Current: **8,176 assertions, 0 failures, ~1 s total, slowest single itinerary 0.9 ms.**

### Interface verification

Every screen was driven in a real browser at 1280×900 and 390×844: `documentElement.scrollWidth === window.innerWidth` on `/`, `/itinerary`, `/place/:id` and `/kannada-kit` (no sideways scroll on a phone), the header reflows to two rows rather than pushing the page wide, the day accordion opens and regenerates with zero console errors, and every control a traveller taps is a ≥40 px target (44 px for the primary ones). Layout guard: `main` and every grid track opt into `min-width: 0`, because a route written as "A → B → C" is otherwise one unbreakable line that inflates its column.

## 5. Kannada, handled properly

- `src/data/phrases.json` — **60 phrases in Kannada script** (Unicode, not transliteration), each with romanisation, English, and tags. Covers greetings, directions, transport, food, markets, temple etiquette and emergencies.
- Audio is the **Web Speech API** with `lang: 'kn-IN'` — no MP3s to host, works offline wherever a voice is installed. If the device has no Kannada voice, the app says so plainly and falls back to the nearest voice; the phonetics are exact either way.
- **Practice mode** hides the Kannada and shows only the English intent: recall before recognition, with a slow playback option for the retroflex consonants.
- `src/data/places.json` — **97 real places** with Kannada names, coordinates, category, entry price, visit hours, best season, and which budget tiers they suit.

## 6. The AI layer (`/api/narrate`)

Provider-agnostic serverless function; `server/narrateHandler.mjs` is the single implementation, mounted by Vite in **both `npm run dev` and `npm run preview`** and wrapped by `api/narrate.js` on Vercel, so **dev, preview and production behave identically**.

- The prompt sends the engine's structured day (times, hours, costs, notes) and demands 70–110 words of second-person guide prose.
- **It may only colour the plan, never replace it**: prices, places and timings come from the engine. The response is length-guarded (40–1600 chars).
- **It never errors at the UI.** No key, timeout, HTTP 500, empty response — every path answers `200 { fallback: true, reason }` and the client keeps the template narration. The header badge reads *"Guide voice"* instead of lying about AI.
- Results cache in localStorage for an hour, so the prose you paid for survives a reload on a train.

## 7. Architecture

```
src/
  data/places.json · phrases.json      curated local data
  lib/itineraryEngine.js               the planner (no deps, no network)
  lib/narrationService.js              AI layer + honest status
  lib/storage.js                       localStorage persistence
  lib/tts.js                           Web Speech Kannada playback
  lib/exporters.js                     text / clipboard / print-to-PDF
  lib/ui.js                            day colours, category meta, money
  context/TripProvider.jsx             prefs + itinerary + regenerate
  components/Header · OnboardingForm · DayCard · StopCard · MapView
             CostSheet · PhraseCard · NarrationBlock · ErrorBoundary
  pages/Onboarding · Itinerary · KannadaKit · PlaceDetail
server/narrateHandler.mjs              provider-agnostic narration
api/narrate.js                         Vercel function wrapper
scripts/test-engine.mjs                conformance suite
```

**Stack** — Vite 5, React 18, React Router 6, Tailwind 3, react-leaflet 4 + OpenStreetMap, Web Speech API, localStorage. No backend, no database, no auth, no analytics.

**Requirement map** — FR-1 onboarding validation · FR-2 scheduled/costed/explained days · FR-3 routing sanity · FR-4 budget bands · FR-5 phrase kit · FR-6 interactive map · FR-7 place pages · FR-8 AI narration + export · FR-9 persistence · FR-10 offline core · FR-11 regenerate day · NFR-1 <2 s (0.9 ms) · NFR-3 client-only planning · NFR-4 responsive · NFR-5 silent AI failure.

## 8. Deploy to Vercel

```bash
npm i -g vercel
vercel        # framework Vite is auto-detected; vercel.json sets rewrites + caching
```

Then, in the Vercel dashboard → Settings → Environment Variables, add `NARRATE_PROVIDER` and one provider key. The site functions identically without them.

## 9. Honest limits

- Travel times are road estimates from haversine distance and terrain-aware speed bands, not live traffic. A ghat road on a holiday Saturday is worse than the estimate.
- Entry prices are the published adult rates we curated; sites change them, and camera/donation charges are not modelled.
- Food-and-stay is a per-day band for the tier, not a booked invoice.
- Tile loading and Google Fonts need a network; the plan, kit, cost sheet and exports do not.
- Kannada TTS quality depends on the voices installed on the visitor's device — a known limit of the Web Speech API, which is why the phonetics are always on screen.

*NammaYatri AI — built for Karnataka, in Karnataka's own script.*
