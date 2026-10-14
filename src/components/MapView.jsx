import React, { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Link } from 'react-router-dom'
import { INR, dayColor } from '@/lib/ui'

/** Start-city marker: a hollow ring, so it never competes with a day's pins. */
function startIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      display:grid;place-items:center;width:26px;height:26px;border-radius:9999px;
      background:#fff;border:3px solid #1B1A17;box-shadow:0 3px 8px rgba(0,0,0,.3);
      font:700 10px Inter,sans-serif;color:#1B1A17">★</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14]
  })
}

function stopIcon(dayNumber, index) {
  const color = dayColor(dayNumber)
  return L.divIcon({
    className: '',
    html: `<div class="ny-pin" style="width:24px;height:24px;background:${color}">${dayNumber}.${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -13]
  })
}

function FitBounds({ itinerary, focus }) {
  const map = useMap()

  useEffect(() => {
    if (!itinerary) return
    const pts = [
      [itinerary.startCityCoords.lat, itinerary.startCityCoords.lng],
      ...itinerary.days.flatMap((d) => d.stops.map((s) => [s.place.lat, s.place.lng]))
    ]
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 11 })
  }, [map, itinerary?.tripId])

  // "Show day N on the map" from a day card
  useEffect(() => {
    if (!focus || focus.points.length === 0) return
    const bounds = L.latLngBounds(focus.points)
    map.fitBounds(bounds.isValid() ? bounds.pad(0.35) : bounds, { animate: true, maxZoom: 11 })
  }, [map, focus?.key])

  return null
}

export default function MapView({ itinerary, activeDay, onActiveDayChange }) {
  const days = itinerary?.days || []

  const perDay = useMemo(
    () =>
      days.map((d) => ({
        day: d.day,
        color: dayColor(d.day),
        points: d.stops.map((s) => [s.place.lat, s.place.lng])
      })),
    [days]
  )

  if (!itinerary) return null

  return (
    <div className="card overflow-hidden print-block">
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-ink-900/5 px-3 py-2.5">
        <p className="label flex-1">Route map</p>
        <button
          type="button"
          onClick={() => onActiveDayChange?.(null)}
          className={`chip chip-touch ${!activeDay ? 'chip-on' : 'chip-off'}`}
        >
          All days
        </button>
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => onActiveDayChange?.(d.day === activeDay ? null : d.day)}
            className={`chip min-h-[2.75rem] min-w-[2.75rem] justify-center !px-2 ${
              d.day === activeDay ? 'chip-on' : 'chip-off'
            }`}
            style={d.day === activeDay ? { background: dayColor(d.day) } : { color: dayColor(d.day) }}
            title={`Day ${d.day} — ${d.base}`}
          >
            {d.day}
          </button>
        ))}
      </div>

      <MapContainer
        center={[14.35, 76.0]}
        zoom={7}
        scrollWheelZoom
        style={{ height: 'clamp(320px, 48vh, 520px)', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[itinerary.startCityCoords.lat, itinerary.startCityCoords.lng]} icon={startIcon()}>
          <Popup>
            <div className="p-3 text-sm">
              <p className="font-bold">Setting off from {itinerary.startCity}</p>
              <p className="text-ink-500">Day 1 is built around here.</p>
            </div>
          </Popup>
        </Marker>

        {perDay.map((d) => {
          const dim = activeDay && activeDay !== d.day
          if (d.points.length > 1) {
            return (
              <Polyline
                key={`line-${d.day}`}
                positions={d.points}
                pathOptions={{ color: d.color, weight: 4, opacity: dim ? 0.15 : 0.85, dashArray: dim ? '4 8' : null }}
              />
            )
          }
          return null
        })}

        {days.map((d) =>
          d.stops.map((s, i) => {
            const dim = activeDay && activeDay !== d.day
            return (
              <Marker
                key={s.placeId}
                position={[s.place.lat, s.place.lng]}
                icon={stopIcon(d.day, i)}
                opacity={dim ? 0.35 : 1}
              >
                <Popup>
                  <div className="p-3 text-sm">
                    <p className="font-bold leading-snug">{s.place.name}</p>
                    <p className="kannada text-primary-700">{s.place.kannada}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      Day {d.day} · {s.startAt} · {s.durationHrs}h · {s.estCost ? INR(s.estCost) : 'free entry'}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed">{s.place.desc}</p>
                    <Link to={`/place/${s.place.id}`} className="mt-2 inline-block text-xs font-bold text-primary-700">
                      Open guide page →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            )
          })
        )}

        <FitBounds itinerary={itinerary} focus={activeDay ? {
          key: `d-${activeDay}-${(days.find((d) => d.day === activeDay) || {}).stops?.length || 0}`,
          points: ((days.find((d) => d.day === activeDay) || {}).stops || []).map((s) => [s.place.lat, s.place.lng])
        } : null} />
      </MapContainer>

      <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-900/5 px-3 py-2 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-[2.5px] border-ink-900 bg-white" /> start city
        </span>
        {days.map((d) => (
          <span key={d.day} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-6 rounded-full" style={{ background: dayColor(d.day) }} />
            day {d.day} · {d.base}
          </span>
        ))}
        <span className="md:ml-auto">Tiles © OpenStreetMap contributors</span>
      </div>
    </div>
  )
}
