import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OnboardingForm from '@/components/OnboardingForm'
import { useTrip } from '@/context/TripProvider'
import { loadDrafts } from '@/lib/storage'

const STEPS = [
  {
    title: 'Four questions, then stop',
    body: 'Interests, days, money, start city. Anything else is the planner’s job — a form with twelve fields is a form people abandon.',
    icon: 'M4 6h16M4 12h10M4 18h7'
  },
  {
    title: 'A plan that respects geography',
    body: 'Every day is one compact area: no day asks you to drive from Hampi to Gokarna and back. Hours, entry costs and travel legs are simulated, not guessed.',
    icon: 'M9 20l-5-2V4l5 2 6-2 5 2v14l-5-2-6 2Zm0 0V6m6 14V8'
  },
  {
    title: 'The words you will actually need',
    body: 'Each day comes with the Kannada for what that day asks of you — the temple queue, the auto, the plate — with phonetics and a listen button.',
    icon: 'M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'
  }
]

export default function Onboarding() {
  const { prefs, plan, itinerary, status } = useTrip()
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState([])

  useEffect(() => setDrafts(loadDrafts()), [])

  const submit = async (values) => {
    const it = await plan(values)
    if (it) navigate('/itinerary')
  }

  return (
    <div className="container-app py-8 sm:py-12">
      <div className="min-track grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        {/* left — the pitch */}
        <section className="animate-fade-up">
          <p className="badge bg-primary-50 text-primary-700 ring-1 ring-primary-200">
            Problem Statement 6 · Karnataka trip planner
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.08] sm:text-5xl">
            Plan Karnataka like someone
            <br />
            who has actually been.
          </h1>
          <p className="kannada mt-2 text-lg text-primary-700">
            ನಮ್ಮ ಊರು, ನಮ್ಮ ದಾರಿ — <span className="font-sans text-ink-500">our town, our road.</span>
          </p>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-700">
            NammaYatri AI turns four answers into a day-by-day itinerary: real places with real entry costs, driving
            times that account for ghat roads, a budget that lands inside the band you chose, and the Kannada you need
            when you get there. It runs offline for the parts that matter.
          </p>

          {itinerary && (
            <div className="card mt-6 flex flex-wrap items-center gap-3 border-l-4 border-l-forest-400 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold leading-tight">
                  {itinerary.dayCount}-day trip from {itinerary.startCity}
                </p>
                <p className="text-sm text-ink-500">
                  {itinerary.regions.join(' · ')} · {itinerary.tierLabel} · still saved on this device
                </p>
              </div>
              <Link to="/itinerary" className="btn-ghost">
                Open it
              </Link>
            </div>
          )}

          <ol className="mt-8 space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-900/5 text-ink-700">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d={s.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold">
                    <span className="text-ink-400">{i + 1}. </span>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* right — the form */}
        <section className="animate-fade-up lg:sticky lg:top-24">
          <OnboardingForm initial={prefs} onSubmit={submit} busy={status === 'planning'} />

          {drafts.length > 1 && (
            <div className="mt-4">
              <p className="label">Recent plans on this device</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {drafts.slice(1, 5).map((d) => (
                  <li key={d.tripId}>
                    <button
                      type="button"
                      className="chip chip-touch chip-off"
                      title={`${d.regions?.join(' · ') || ''} · planned ${new Date(d.savedAt).toLocaleDateString()}`}
                      onClick={() => plan(d)}
                    >
                      {d.dayCount}d · {d.startCity} · {d.tierLabel}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
