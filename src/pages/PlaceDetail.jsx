import React, { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import NarrationBlock from '@/components/NarrationBlock'
import PhraseCard, { VoiceNote } from '@/components/PhraseCard'
import { useTrip } from '@/context/TripProvider'
import { CATEGORY_TAGS, ALL_PLACES, ALL_PHRASES, haversineKm, placeById, templateHighlight } from '@/lib/itineraryEngine'
import { INR, catMeta } from '@/lib/ui'

const pin = (color) =>
  L.divIcon({
    className: '',
    html: `<div class="ny-pin" style="width:26px;height:26px;background:${color}">★</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  })

export default function PlaceDetail() {
  const { id } = useParams()
  const { itinerary } = useTrip()
  const place = placeById(id)

  const nearby = useMemo(() => {
    if (!place) return []
    return ALL_PLACES.filter((p) => p.id !== place.id)
      .map((p) => ({ p, km: Math.round(haversineKm(place, p)) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 6)
  }, [place?.id])

  const phrases = useMemo(() => {
    if (!place) return []
    const want = new Set()
    place.category.forEach((c) => (CATEGORY_TAGS[c] || []).forEach((t) => want.add(t)))
    want.add('greeting')
    const scored = ALL_PHRASES.map((p) => ({
      p,
      hits: p.tags.filter((t) => want.has(t)).length
    }))
      .sort((a, b) => b.hits - a.hits || a.p.id.localeCompare(b.p.id))
      .slice(0, 5)
    return scored.map((x) => x.p)
  }, [place?.id])

  const inTrip = useMemo(() => {
    if (!itinerary || !place) return []
    return itinerary.days
      .flatMap((d) => d.stops.filter((s) => s.placeId === place.id).map((s) => ({ day: d.day, base: d.base, at: s.startAt, block: s.timeBlock })))
  }, [itinerary, place?.id])

  if (!place) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="font-display text-2xl font-bold">That place is not in our list</h1>
        <p className="mt-2 text-sm text-ink-500">
          NammaYatri plans from {ALL_PLACES.length} curated Karnataka places.{' '}
          <Link to="/" className="font-semibold text-primary-700 hover:underline">
            Back to planning
          </Link>
        </p>
      </div>
    )
  }

  const tone = catMeta(place.category[0]).tone

  return (
    <div className="container-app py-6 sm:py-8">
      <nav className="no-print mb-3 flex flex-wrap items-center text-sm text-ink-500">
        <Link to="/" className="inline-flex min-h-[2.75rem] items-center px-2 hover:text-primary-700">
          Plan
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-ink-700">{place.region}</span>
        <span className="mx-2">/</span>
        <span>{place.subRegion}</span>
      </nav>

      <header className="print-block">
        <div className="flex flex-wrap items-center gap-2">
          {place.category.map((c) => {
            const m = catMeta(c)
            return (
              <span key={c} className={`chip ${m.tone}`}>
                <span aria-hidden>{m.emoji}</span>
                {m.label}
              </span>
            )
          })}
          <span className="chip bg-ink-900/5 text-ink-600">popularity {place.popularity}/10</span>
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight">{place.name}</h1>
        <p className="kannada mt-1 text-xl text-primary-700">{place.kannada}</p>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-700">{place.desc}</p>
      </header>

      <div className="min-track mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="space-y-5">
          {/* the facts a traveller actually checks */}
          <dl className="min-track card grid grid-cols-2 gap-px overflow-hidden p-0 print-block">
            {[
              { k: 'Entry', v: place.entryCost ? INR(place.entryCost) : 'Free' },
              { k: 'Time needed', v: `${place.avgVisitHrs} hours` },
              { k: 'Best time to go', v: place.bestTime },
              { k: 'Fits budgets', v: place.budgetTier.join(' · ') },
              { k: 'Area', v: `${place.subRegion}, ${place.region}` },
              { k: 'Coordinates', v: `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}` }
            ].map((row) => (
              <div key={row.k} className="border-b border-r border-ink-900/5 p-3.5">
                <dt className="label">{row.k}</dt>
                <dd className="mt-1 break-words text-sm font-semibold capitalize text-ink-900">{row.v}</dd>
              </div>
            ))}
          </dl>

          <div className={`rounded-xl px-4 py-3 ring-1 ${tone}`}>
            <p className="text-sm leading-relaxed">{templateHighlight(place)}</p>
          </div>

          <NarrationBlock
            template={templateHighlight(place)}
            payload={{ kind: 'place', place, ctx: { tripNote: inTrip.length ? `It is day ${inTrip[0].day} of a live plan` : '' } }}
          />

          <div className="no-print flex flex-wrap gap-2">
            <a
              className="btn-ghost btn-touch !px-3 text-xs"
              href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=15/${place.lat}/${place.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in maps
            </a>
            <a
              className="btn-ghost btn-touch !px-3 text-xs"
              href={`geo:${place.lat},${place.lng}?q=${place.lat},${place.lng}(${encodeURIComponent(place.name)})`}
            >
              Navigate here
            </a>
            {itinerary && (
              <Link to="/itinerary" className="btn-quiet btn-touch !px-3 text-xs">
                Back to my trip
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card overflow-hidden print-block">
            <MapContainer
              center={[place.lat, place.lng]}
              zoom={12}
              scrollWheelZoom={false}
              style={{ height: 'clamp(240px, 34vh, 340px)', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[place.lat, place.lng]} icon={pin('#9B2226')} />
            </MapContainer>
          </div>

          {inTrip.length > 0 && (
            <div className="card border-l-4 border-l-forest-400 p-4">
              <p className="label">In your plan</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                {inTrip.map((s) => (
                  <li key={`${s.day}-${s.at}`}>
                    Day {s.day} · {s.base} — you arrive around <span className="font-semibold">{s.at}</span> ({s.block})
                  </li>
                ))}
              </ul>
              <Link to="/itinerary" className="btn-primary btn-touch mt-3 !px-3 text-xs">
                See the whole itinerary
              </Link>
            </div>
          )}

          <section className="card p-4">
            <p className="label">Near this place</p>
            <ul className="mt-2 divide-y divide-ink-900/5">
              {nearby.map(({ p, km }) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Link to={`/place/${p.id}`} className="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-3">
                    <span className="block truncate text-sm font-semibold hover:text-primary-700">{p.name}</span>
                    <span className="kannada block truncate text-xs text-ink-500">{p.kannada}</span>
                  </Link>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-xs font-bold text-ink-700">{km} km</span>
                    <span className="block text-[11px] text-ink-400">{km < 8 ? 'same area' : 'short hop'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="label mb-2">Say this while you are here</p>
            <VoiceNote />
            <ul className="space-y-3" key={place.id}>
              {phrases.map((p, i) => (
                <PhraseCard key={p.id} phrase={p} index={i} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
