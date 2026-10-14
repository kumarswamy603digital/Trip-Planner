import React, { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTrip } from '@/context/TripProvider'
import { narrationStatus, onNarrationStatus, probe } from '@/lib/narrationService'

export default function Header() {
  const { itinerary, reset } = useTrip()
  const navigate = useNavigate()
  const [ai, setAi] = useState(narrationStatus())

  useEffect(() => {
    probe().catch(() => {})
    return onNarrationStatus(setAi)
  }, [])

  const link = ({ isActive }) =>
    `flex min-h-[2.75rem] items-center rounded-full px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-primary-700 text-white' : 'text-ink-700 hover:bg-ink-900/5'
    }`

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-900/10 bg-sand-50/85 backdrop-blur-md">
      {/*
        Wraps instead of overflowing: on a 390px phone the brand, the three nav links and
        the status badge do not fit on one line, and a nowrap row pushes the whole page wide.
      */}
      <div className="container-app flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
        <Link to="/" className="group flex min-h-[2.75rem] min-w-0 items-center gap-2.5" title="NammaYatri AI home">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-700 text-white shadow-lift transition group-hover:rotate-6">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-bold sm:text-lg">NammaYatri AI</span>
            <span className="kannada -mt-0.5 hidden text-[11px] text-ink-500 sm:block">
              ನಮ್ಮ ಯಾತ್ರಿ · Karnataka, planned
            </span>
          </span>
        </Link>

        {/*
          One wrapping cluster: on a phone it drops below the brand as a second row, on a
          wide screen it is pushed to the right edge so nav · badge · New trip read as a group.
        */}
        <div className="order-last flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-ink-900/5 pt-1.5 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={link}>
              Plan
            </NavLink>
            {itinerary && (
              <NavLink to="/itinerary" className={link}>
                Itinerary
              </NavLink>
            )}
            <NavLink to="/kannada-kit" className={link}>
              Kannada kit
            </NavLink>
          </nav>

          <span
            className="badge ml-auto hidden sm:inline-flex"
            title={
              ai.ai
                ? `AI narration live via ${ai.reason}`
                : `Using the built-in guide voice (${ai.reason}) — the plan is identical either way`
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                ai.ai ? 'bg-forest-400' : ai.checked ? 'bg-sand-500' : 'bg-ink-300'
              } ${ai.ai ? 'animate-pulse-soft' : ''}`}
            />
            {ai.ai ? 'AI guide' : 'Guide voice'}
          </span>

          {itinerary && (
            <button
              type="button"
              onClick={() => {
                reset()
                navigate('/')
              }}
              className="btn-quiet btn-touch ml-auto !px-3 !py-1.5 text-xs sm:ml-0"
              title="Clear this trip"
            >
              New trip
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
