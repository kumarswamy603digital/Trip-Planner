import React, { useMemo, useState } from 'react'
import { BUDGET_TIERS, INTERESTS, START_CITIES } from '@/lib/itineraryEngine'
import { TIME_FOR_DAY } from '@/lib/ui'

const MIN_INTERESTS = 1

/**
 * The four questions the blueprint allows (FR-1). Everything else is the engine's job,
 * which is why there is no fifth field: the plan is what the traveller should react to.
 */
export default function OnboardingForm({ initial, onSubmit, busy }) {
  const [interests, setInterests] = useState(initial.interests)
  const [days, setDays] = useState(initial.days)
  const [budget, setBudget] = useState(initial.budget)
  const [startCity, setStartCity] = useState(initial.startCity)
  const [touched, setTouched] = useState(false)

  const error = useMemo(() => {
    if (interests.length < MIN_INTERESTS) return 'Pick at least one thing you want this trip to be about.'
    if (days < 1 || days > 7) return 'Days must be between 1 and 7.'
    if (!BUDGET_TIERS[budget]) return 'Choose a budget tier.'
    if (!START_CITIES.some((c) => c.id === startCity)) return 'Choose where you are setting off from.'
    return ''
  }, [interests, days, budget, startCity])

  const toggle = (id) => {
    setTouched(true)
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (error) return
    onSubmit({ interests, days, budget, startCity })
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-7" noValidate>
      {/* 1 — interests */}
      <fieldset className="border-0 p-0">
        <legend className="label">1 · What is this trip about?</legend>
        <p className="mt-1 text-sm text-ink-500">
          Pick as many as you like — the engine scores every place against what you chose.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((it) => {
            const on = interests.includes(it.id)
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => toggle(it.id)}
                aria-pressed={on}
                className={`chip chip-touch ${on ? 'chip-on' : 'chip-off'}`}
              >
                <span aria-hidden>{it.emoji}</span>
                {it.label}
                <span className={`kannada text-[11px] ${on ? 'text-primary-100' : 'text-ink-400'}`}>{it.kannada}</span>
              </button>
            )
          })}
        </div>
        {touched && error && interests.length < MIN_INTERESTS && (
          <p role="alert" className="mt-2 text-sm font-semibold text-primary-700">
            {error}
          </p>
        )}
      </fieldset>

      <div className="rule my-6" />

      {/* 2 — days */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="days" className="label">
            2 · How many days?
          </label>
          <span className="font-display text-2xl font-bold text-primary-700">
            {days} <span className="text-sm font-semibold text-ink-500">{days === 1 ? 'day' : 'days'}</span>
          </span>
        </div>
        <input
          id="days"
          type="range"
          min="1"
          max="7"
          step="1"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="mt-3 w-full accent-primary-700"
        />
        <div className="mt-1 flex justify-between px-0.5 text-[11px] font-semibold text-ink-400">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span key={n} className={n === days ? 'text-primary-700' : ''}>
              {n}
            </span>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-500">{TIME_FOR_DAY[days]}</p>
      </div>

      <div className="rule my-6" />

      {/* 3 — budget */}
      <fieldset className="border-0 p-0">
        <legend className="label">3 · Money per day, per person</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {Object.entries(BUDGET_TIERS).map(([id, tier]) => {
            const on = budget === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setBudget(id)}
                aria-pressed={on}
                className={`rounded-xl p-3 text-left ring-1 transition ${
                  on
                    ? 'bg-primary-50 ring-primary-600 shadow-lift'
                    : 'bg-white/70 ring-ink-900/10 hover:bg-white hover:ring-ink-900/20'
                }`}
              >
                <span className="block font-display text-base font-bold">{tier.label}</span>
                <span className="block text-sm text-ink-500">{tier.perDay}</span>
                <span className="mt-1 block text-xs text-ink-500">
                  {id === 'budget'
                    ? 'KSRTC bus, lodge or homestay, canteen meals'
                    : id === 'comfort'
                      ? 'Cab or good bus, hotel, one guided stop a day'
                      : 'Private cab, heritage stay, experiences booked'}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="rule my-6" />

      {/* 4 — start city */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="startCity" className="label">
            4 · Setting off from
          </label>
          <select
            id="startCity"
            value={startCity}
            onChange={(e) => setStartCity(e.target.value)}
            className="mt-2 w-full rounded-xl border-0 bg-white/80 px-3 py-2.5 text-sm font-semibold ring-1 ring-ink-900/10 focus:ring-2 focus:ring-primary-600"
          >
            {START_CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.kannada}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <p className="max-w-[15rem] text-xs text-ink-500">
            Routing starts here: the first day is built around your own city, then the plan walks down the state as
            one chain.
          </p>
          <button type="submit" className="btn-primary shrink-0 text-base" disabled={busy || !!error}>
            {busy ? 'Planning…' : 'Plan my trip'}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h13M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </form>
  )
}
