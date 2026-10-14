import React from 'react'
import { Link } from 'react-router-dom'
import { INR, catMeta } from '@/lib/ui'

/** One stop on one day: when, what, why, what it costs, and how to reach it. */
export default function StopCard({ stop, index }) {
  const p = stop.place
  return (
    <li className="relative pl-9">
      {/* the day's spine */}
      <span className="absolute left-[13px] top-8 bottom-0 w-px bg-ink-900/10" aria-hidden />
      <span
        className="absolute left-0 top-1 grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-white"
        style={{ background: 'var(--day-color, #9B2226)' }}
      >
        {index + 1}
      </span>

      <div className="print-block card card-hover p-4">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <time className="rounded-lg bg-ink-900/5 px-2 py-1 font-mono text-xs font-bold text-ink-700">
            {stop.startAt}
          </time>
          <h4 className="min-w-0 flex-1 break-words font-display text-lg font-bold leading-snug">
            <Link to={`/place/${p.id}`} className="hover:text-primary-700">
              {p.name}
            </Link>
          </h4>
          <span className="text-sm font-semibold text-ink-500">
            {stop.durationHrs}h
            {stop.estCost > 0 && <> · {INR(stop.estCost)}</>}
            {stop.estCost === 0 && <> · free entry</>}
          </span>
        </div>

        <p className="kannada mt-1 text-sm text-primary-700">{p.kannada}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.category.map((c) => {
            const m = catMeta(c)
            return (
              <span key={c} className={`chip ${m.tone} !px-2 !py-0.5 !text-[11px]`}>
                <span aria-hidden>{m.emoji}</span>
                {m.label}
              </span>
            )
          })}
          <span className="chip bg-ink-900/5 text-ink-500 !px-2 !py-0.5 !text-[11px]">
            {stop.timeBlock}
          </span>
          {stop.hopKm > 1 && (
            <span className="chip bg-ink-900/5 text-ink-500 !px-2 !py-0.5 !text-[11px]">{stop.hopKm} km hop</span>
          )}
        </div>

        <p className="mt-2 text-sm leading-relaxed text-ink-700">{p.desc}</p>
        {stop.why && (
          <p className="mt-2 border-l-2 border-ochre-300 pl-3 text-sm italic leading-relaxed text-ink-600">
            {stop.why.replace(/^Why you'll love this: /, '')}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
          <span>
            Best time: <span className="font-semibold text-ink-700">{p.bestTime}</span>
          </span>
          <span>
            {p.subRegion}, {p.region}
          </span>
          <Link
            to={`/place/${p.id}`}
            className="ml-auto inline-flex min-h-[2.75rem] items-center font-semibold text-primary-700 hover:underline"
            title="Open the guide page for this place"
          >
            Guide page →
          </Link>
        </div>
      </div>
    </li>
  )
}
