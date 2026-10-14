import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { generateItinerary, regenerateDay as regenDayInEngine } from '@/lib/itineraryEngine'
import {
  DEFAULT_PREFS,
  clearTrip as clearStoredTrip,
  loadItinerary,
  loadPrefs,
  pushDraft,
  saveItinerary,
  savePrefs
} from '@/lib/storage'

const TripContext = createContext(null)

export function TripProvider({ children }) {
  const [prefs, setPrefs] = useState(() => loadPrefs())
  const [itinerary, setItinerary] = useState(() => loadItinerary())
  const [status, setStatus] = useState('idle') // idle | planning | ready | error
  const [error, setError] = useState('')

  // restore whatever this traveller planned last time (FR-9)
  useEffect(() => {
    if (itinerary) setStatus('ready')
  }, [])

  const plan = useCallback(
    async (override = {}) => {
      const next = { ...prefs, ...override }
      setPrefs(next)
      savePrefs(next)
      setStatus('planning')
      setError('')
      try {
        // one frame so the skeleton paints; the engine itself takes ~1 ms
        await new Promise((r) => setTimeout(r, 220))
        const it = generateItinerary({
          interests: next.interests,
          days: Number(next.days),
          budget: next.budget,
          startCity: next.startCity,
          seed: Math.floor(Math.random() * 100000)
        })
        setItinerary(it)
        saveItinerary(it)
        pushDraft(it)
        setStatus('ready')
        return it
      } catch (e) {
        // the engine is total, so this only fires on a corrupt store; keep the old trip
        setStatus(itinerary ? 'ready' : 'error')
        setError(e?.message || 'planning failed')
        return null
      }
    },
    [prefs, itinerary]
  )

  const shuffleDay = useCallback(
    async (dayNumber) => {
      if (!itinerary) return
      setStatus('planning')
      await new Promise((r) => setTimeout(r, 160))
      const next = regenDayInEngine(itinerary, dayNumber, Math.floor(Math.random() * 100000))
      setItinerary(next)
      saveItinerary(next)
      setStatus('ready')
    },
    [itinerary]
  )

  const reset = useCallback(() => {
    clearStoredTrip()
    setItinerary(null)
    setStatus('idle')
    setPrefs({ ...DEFAULT_PREFS })
  }, [])

  const value = useMemo(
    () => ({ prefs, setPrefs, itinerary, status, error, plan, shuffleDay, reset }),
    [prefs, itinerary, status, error, plan, shuffleDay, reset]
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

export function useTrip() {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip must be used inside TripProvider')
  return ctx
}
