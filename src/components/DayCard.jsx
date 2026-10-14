import React from 'react'
import StopCard from './StopCard'
import NarrationBlock from './NarrationBlock'
import { INR, dayColor } from '@/lib/ui'
import { phraseById } from '@/lib/itineraryEngine'

const BLOCK_ICON = { morning: '🌄', afternoon: '☀️', evening: '🌆' }

export default function DayCard({ day, itinerary, open, onToggle, onRegenerate, onFocus, busy }) {
  const color = dayColor(day.day)
  const leg = day.travelLeg || { km: 0, hours: 0, note: '' }
  const phrases = (day.phrases || []).map(phraseById).filter(Boolean)
  const longestHop = Math.max(0, ...day.stops.map((s) => s.hopKm || 0))

  return (
    <article className="card overflow-hidden print-block" style={{ '--day-color': color }}>
      {/* header row is always visible */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`day-panel-${day.day}`}
        className="flex min-h-[2.75rem] w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-ink-900/[0.03]"
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-bold text-white"
          style={{ background: color }}
        >
          {day.day}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold leading-tight">
            {day.base}
            <span className="ml-2 text-sm font-semibold text-ink-500">{day.region}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-500">
            {day.stops.map((s) => s.place.name).join(' → ')}
          </span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block font-display text-lg font-bold" style={{ color }}>
            {INR(day.dayCost)}
          </span>
          <span className="block text-xs text-ink-500">
            {day.stops.length} stop{day.stops.length === 1 ? '' : 's'} · {day.distanceKm} km
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="flex items-center gap-2 border-t border-ink-900/5 px-4 py-2 sm:hidden">
        <span className="text-sm font-bold" style={{ color }}>
          {INR(day.dayCost)}
        </span>
        <span className="text-xs text-ink-500">
          {day.stops.length} stops · {day.distanceKm} km
        </span>
      </div>

      {open && (
        <div id={`day-panel-${day.day}`} className="animate-fade-up space-y-5 px-4 pb-5 pt-3">
          {/* travel leg into the day */}
          {leg.km > 3 && (
            <div className="flex items-start gap-3 rounded-xl bg-ink-900/[0.04] p-3">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-ink-600" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 13h13l-2-4H6l-3 4Zm0 0v4h2m11-4 3 4h2m-3 0v2m-11-2v2M8 9l1-4h6l1 4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="7.5" cy="17.5" r="1.4" />
                <circle cx="16.5" cy="17.5" r="1.4" />
              </svg>
              <p className="text-sm leading-relaxed text-ink-700">
                <span className="font-semibold">
                  {leg.km} km, about {leg.hours} h
                </span>{' '}
                — {leg.note}
              </p>
            </div>
          )}

          {/* the stops */}
          <ol className="space-y-4">
            {day.stops.map((s, i) => (
              <StopCard key={s.placeId} stop={s} index={i} />
            ))}
          </ol>

          {/* how to get around + the day's money */}
          <div className="min-track grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-forest-50 p-4 ring-1 ring-forest-100">
              <p className="label text-forest-700">Getting around</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{day.gettingAround}</p>
              <ul className="mt-3 space-y-1 text-xs text-ink-600">
                {['entry tickets', 'local travel', 'food and stay', 'guides and experiences'].map((label, i) => {
                  const value = [day.breakdown.entry, day.breakdown.localTransport, day.breakdown.foodStay, day.breakdown.experiences][i]
                  return (
                    <li key={label} className="flex justify-between gap-3">
                      <span>{label}</span>
                      <span className="font-mono font-semibold">{INR(value)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="rounded-xl bg-sand-100/70 p-4 ring-1 ring-ink-900/5">
              <p className="label">Kannada you will need today</p>
              {phrases.length ? (
                <ul className="mt-2 space-y-2">
                  {phrases.map((p) => (
                    <li key={p.id}>
                      <span className="kannada block text-[15px] font-semibold leading-snug text-ink-900">{p.kannada}</span>
                      <span className="phonetic">{p.phonetic}</span>
                      <span className="text-ink-500"> — {p.english}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-sm text-ink-500">A quiet day — namaskāra is enough.</p>
              )}
              <p className="mt-3 text-xs text-ink-500">
                Day blocks:{' '}
                {[...new Set(day.stops.map((s) => s.timeBlock))]
                  .map((b) => `${BLOCK_ICON[b] || ''} ${b}`)
                  .join('  ')}
              </p>
            </div>
          </div>

          <NarrationBlock
            template={day.narration}
            payload={{
              kind: 'day',
              day,
              tripId: itinerary.tripId,
              ctx: {
                startCity: itinerary.startCity,
                tierLabel: itinerary.tierLabel,
                dayCount: itinerary.dayCount,
                interests: itinerary.interests
              }
            }}
          />

          <div className="no-print flex flex-wrap items-center gap-2">
            <button type="button" onClick={onRegenerate} disabled={busy} className="btn-ghost btn-touch !px-3 text-xs">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M17 4v3h-3M7 20v-3h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {busy ? 'Rebuilding…' : 'Regenerate this day'}
            </button>
            <button type="button" onClick={onFocus} className="btn-quiet btn-touch !px-3 text-xs">
              Show day {day.day} on the map
            </button>
            <span className="ml-auto text-xs text-ink-400">
              {longestHop > 0
                ? `One compact area — the longest hop between stops is ${longestHop} km`
                : 'Everything today is within walking distance of the same base'}
            </span>
          </div>
        </div>
      )}
    </article>
  )
}
