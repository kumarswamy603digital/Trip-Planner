import React, { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import CostSheet from '@/components/CostSheet'
import DayCard from '@/components/DayCard'
import MapView from '@/components/MapView'
import { useTrip } from '@/context/TripProvider'
import { copyToClipboard, downloadText, itineraryToText, printItinerary } from '@/lib/exporters'
import { INR } from '@/lib/ui'

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-sm font-semibold text-ink-500">Scoring 97 places, clustering them into day-sized areas…</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-24 w-full" />
      ))}
      <div className="skeleton h-72 w-full" />
    </div>
  )
}

export default function ItineraryPage() {
  const { itinerary, status, plan, shuffleDay } = useTrip()
  const [openDay, setOpenDay] = useState(1)
  const [activeDay, setActiveDay] = useState(null)
  const [toast, setToast] = useState('')
  const [shuffleDayNumber, setShuffleDayNumber] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const summary = useMemo(() => {
    if (!itinerary) return null
    return {
      stops: itinerary.days.reduce((s, d) => s + d.stops.length, 0),
      km: itinerary.days.reduce((s, d) => s + d.distanceKm, 0)
    }
  }, [itinerary])

  if (!itinerary) {
    if (status === 'planning') {
      return (
        <div className="container-app py-10">
          <Skeleton />
        </div>
      )
    }
    return <Navigate to="/" replace />
  }

  const copy = async () => {
    const ok = await copyToClipboard(itineraryToText(itinerary))
    setToast(ok ? 'Copied — paste it straight into WhatsApp' : 'Copy blocked by the browser; use Download')
  }

  const share = async () => {
    const text = `${itinerary.dayCount}-day Karnataka trip from ${itinerary.startCity}: ${itinerary.days
      .map((d) => d.base)
      .join(' → ')}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Karnataka trip', text, url: window.location.href })
        return
      } catch {
        /* the traveller dismissed the sheet — fall back to copy */
      }
    }
    copy()
  }

  return (
    <div className="container-app py-6 sm:py-8">
      {/* trip header */}
      <header className="print-block mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="label">
            {itinerary.interests.join(' · ')} — planned by the engine, not copied from a list
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight sm:text-4xl">
            {itinerary.dayCount} days across {itinerary.regions.length} region
            {itinerary.regions.length === 1 ? '' : 's'}
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            From <span className="font-semibold text-ink-700">{itinerary.startCity}</span> ·{' '}
            {itinerary.regions.join(' → ')} · {summary.stops} stops · {summary.km} km on the road ·{' '}
            <span className="font-semibold text-primary-700">{INR(itinerary.totalCost)}</span> for the trip,{' '}
            {itinerary.tierLabel.toLowerCase()} band
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className="btn-ghost btn-touch !px-3 text-xs">
            Copy for WhatsApp
          </button>
          <button
            type="button"
            onClick={() => downloadText(`namma-yatri-${itinerary.dayCount}d-${itinerary.startCity.toLowerCase()}.txt`, itineraryToText(itinerary))}
            className="btn-ghost btn-touch !px-3 text-xs"
          >
            Download .txt
          </button>
          <button type="button" onClick={() => printItinerary(itinerary)} className="btn-ghost btn-touch !px-3 text-xs">
            Save as PDF
          </button>
          <button type="button" onClick={share} className="btn-primary btn-touch !px-3 text-xs">
            Share
          </button>
          <button
            type="button"
            onClick={() => plan({})}
            className="btn-quiet btn-touch !px-3 text-xs"
            title="Run the engine again on the same four answers"
          >
            Replan everything
          </button>
        </div>
      </header>

      {status === 'planning' && !shuffleDayNumber && (
        <p className="no-print mb-4 rounded-xl bg-sand-100 px-3 py-2 text-xs font-semibold text-ink-600">
          Rebuilding the trip…
        </p>
      )}

      <div className="min-track grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        {/* days */}
        <div className="space-y-4">
          {itinerary.days.map((d) => (
            <div key={`${itinerary.tripId}-${d.day}`} id={`day-${d.day}`} className="scroll-mt-32 sm:scroll-mt-24">
              <DayCard
                day={d}
                itinerary={itinerary}
                open={openDay === d.day}
                busy={status === 'planning' && shuffleDayNumber === d.day}
                onToggle={() => setOpenDay(openDay === d.day ? null : d.day)}
                onFocus={() => {
                  setActiveDay(d.day)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                onRegenerate={async () => {
                  setShuffleDayNumber(d.day)
                  await shuffleDay(d.day)
                  setShuffleDayNumber(null)
                  setToast(`Day ${d.day} rebuilt around ${d.region}`)
                }}
              />
            </div>
          ))}

          <CostSheet itinerary={itinerary} />
        </div>

        {/* map — sticky beside the days on a wide screen */}
        <div className="no-print lg:sticky lg:top-24">
          <MapView itinerary={itinerary} activeDay={activeDay} onActiveDayChange={setActiveDay} />
          <div className="card mt-4 p-4">
            <p className="label">Why this route</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-600">
              <li>
                Each day is one compact area — the engine clusters places by sub-region and refuses a hop over{' '}
                <span className="font-semibold">70 km</span> inside a day.
              </li>
              <li>
                Long legs are billed as long legs: ghat and coastal roads are estimated at{' '}
                <span className="font-semibold">42–52 km/h</span>, city hops at 34.
              </li>
              <li>
                Every day is then costed and forced into your band by swapping in cheaper alternates from the same
                area before the flexible lines absorb the rest.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        className="no-print fixed bottom-5 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2 text-center text-sm font-semibold text-white shadow-lift transition"
        style={{ opacity: toast ? 1 : 0, pointerEvents: toast ? 'auto' : 'none' }}
        role="status"
      >
        {toast}
      </div>
    </div>
  )
}
