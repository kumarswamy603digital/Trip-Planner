import React from 'react'
import { BUDGET_TIERS } from '@/lib/itineraryEngine'
import { INR, dayColor } from '@/lib/ui'

const LINES = [
  { key: 'entry', label: 'Entry tickets', tone: '#9B2226' },
  { key: 'localTransport', label: 'Local travel', tone: '#CA6702' },
  { key: 'foodStay', label: 'Food & stay', tone: '#2A9D8F' },
  { key: 'experiences', label: 'Guides & experiences', tone: '#588157' }
]

/** FR-4 made visible: where the money goes, per day, and proof it sits in the band. */
export default function CostSheet({ itinerary }) {
  const band = BUDGET_TIERS[itinerary.tier]
  const totals = LINES.reduce(
    (acc, l) => ({ ...acc, [l.key]: itinerary.days.reduce((s, d) => s + d.breakdown[l.key], 0) }),
    {}
  )
  const grand = itinerary.days.reduce((s, d) => s + d.dayCost, 0)
  const perDay = Math.round(grand / itinerary.days.length)

  return (
    <section className="card p-5 print-block">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-xl font-bold">Cost sheet</h3>
        <p className="text-sm text-ink-500">
          {itinerary.tierLabel} band {band.perDay} / day / person
        </p>
        <p className="ml-auto font-display text-2xl font-bold text-primary-700">{INR(grand)}</p>
      </div>

      <div className="mt-4 space-y-3">
        {itinerary.days.map((d) => {
          const inBand = d.dayCost >= band.min && d.dayCost <= band.max
          return (
            <div key={d.day} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-sm font-semibold" style={{ color: dayColor(d.day) }}>
                Day {d.day}
              </span>
              <div className="flex h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-900/5" title={`Day ${d.day}: ${INR(d.dayCost)}`}>
                {LINES.map((l) => (
                  <span
                    key={l.key}
                    style={{ width: `${(d.breakdown[l.key] / d.dayCost) * 100}%`, background: l.tone }}
                    title={`${l.label}: ${INR(d.breakdown[l.key])}`}
                  />
                ))}
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold">{INR(d.dayCost)}</span>
              <span
                className={`w-20 shrink-0 text-right text-[11px] font-bold ${inBand ? 'text-forest-600' : 'text-ochre-600'}`}
                title={inBand ? 'Inside the band you chose' : 'Nearest honest fit for this geography'}
              >
                {inBand ? 'in band' : 'tight fit'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="rule my-4" />

      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {LINES.map((l) => (
          <li key={l.key} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: l.tone }} />
            <span className="text-ink-500">{l.label}</span>
            <span className="ml-auto font-mono font-semibold">{INR(totals[l.key])}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-ink-900/[0.04] px-3 py-2.5 text-sm">
        <span className="text-ink-500">
          Average day <span className="font-mono font-bold text-ink-900">{INR(perDay)}</span>
        </span>
        <span className="text-ink-500">
          Total distance <span className="font-mono font-bold text-ink-900">{itinerary.days.reduce((s, d) => s + d.distanceKm, 0)} km</span>
        </span>
        <span className="text-ink-500">
          Stops <span className="font-mono font-bold text-ink-900">{itinerary.days.reduce((s, d) => s + d.stops.length, 0)}</span>
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        Per person, ₹, excluding your onward travel from home and anything you buy. Entry prices are the published
        adult rates for these sites; food and stay are the honest regional range for your tier.
      </p>
    </section>
  )
}
