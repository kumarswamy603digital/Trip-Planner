import React, { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PhraseCard, { VoiceNote } from '@/components/PhraseCard'
import { useTrip } from '@/context/TripProvider'
import { ALL_PHRASES, phraseById } from '@/lib/itineraryEngine'
import { speak, stopSpeaking, ttsSupported } from '@/lib/tts'

const GROUPS = [
  { id: 'greeting', label: 'Being polite', kannada: 'ಮর್ಯಾದೆ' },
  { id: 'directions', label: 'Finding your way', kannada: 'ದಾರಿ' },
  { id: 'transport', label: 'Buses, autos, cabs', kannada: 'ಪ್ರಯಾಣ' },
  { id: 'food', label: 'Ordering food', kannada: 'ಊಟ' },
  { id: 'market', label: 'Shops and prices', kannada: 'ಸಂತೆ' },
  { id: 'temple', label: 'In the temple', kannada: 'ದೇವಾಲಯ' },
  { id: 'emergency', label: 'When you need help', kannada: 'ಸಹಾಯ' }
]

export default function KannadaKit() {
  const { itinerary } = useTrip()
  const [practice, setPractice] = useState(false)
  const [showAll, setShowAll] = useState(!itinerary)
  const [playing, setPlaying] = useState('')

  const kitIds = itinerary?.phraseIds || []

  const kit = useMemo(() => {
    if (showAll) {
      return GROUPS.map((g) => ({
        ...g,
        phrases: ALL_PHRASES.filter((p) => p.tags.includes(g.id))
      })).filter((g) => g.phrases.length)
    }
    const byTag = new Map()
    kitIds.forEach((id) => {
      const p = phraseById(id)
      if (!p) return
      const tag = p.tags[0]
      if (!byTag.has(tag)) byTag.set(tag, [])
      byTag.get(tag).push(p)
    })
    return GROUPS.filter((g) => byTag.has(g.id)).map((g) => ({ ...g, phrases: byTag.get(g.id) }))
  }, [showAll, kitIds])

  const playToken = useRef(0)

  const listenAll = (group) => {
    if (!ttsSupported()) return
    playToken.current += 1
    const token = playToken.current
    setPlaying(group.id)
    let i = 0
    const step = () => {
      if (token !== playToken.current) return
      if (i >= group.phrases.length) {
        setPlaying('')
        return
      }
      const p = group.phrases[i++]
      speak(p.kannada, { lang: p.audioLang, rate: 0.78, onEnd: () => setTimeout(step, 420) })
    }
    step()
  }

  const stopAll = () => {
    playToken.current += 1
    stopSpeaking()
    setPlaying('')
  }

  return (
    <div className="container-app py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="label">ನಮ್ಮ ಭಾಷೆ · our language</p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight sm:text-4xl">Kannada survival kit</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-500">
            {itinerary
              ? `These ${kitIds.length} phrases are the ones your ${itinerary.dayCount}-day route through ${itinerary.regions.join(', ')} will actually ask of you — the temple queue, the auto, the plate, the bill.`
              : 'Plan a trip and the kit becomes yours specifically. Until then, here is the whole phrasebook, grouped by what you are trying to do.'}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPractice((p) => !p)}
            className={`chip chip-touch ${practice ? 'chip-on' : 'chip-off'}`}
            aria-pressed={practice}
            title="Hide the Kannada until you have said it out loud"
          >
            {practice ? 'Practice mode on' : 'Practice mode'}
          </button>
          {itinerary && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className={`chip chip-touch ${showAll ? 'chip-on' : 'chip-off'}`}
              aria-pressed={showAll}
            >
              {showAll ? 'My trip kit' : `All ${ALL_PHRASES.length} phrases`}
            </button>
          )}
        </div>
      </header>

      <VoiceNote />

      {!itinerary && (
        <div className="card mt-4 flex flex-wrap items-center gap-3 border-l-4 border-l-primary-600 p-4">
          <p className="min-w-0 flex-1 text-sm text-ink-600">
            <span className="font-semibold">A kit should match the trip.</span> Plan a route and the phrase list
            narrows to the eight to twelve you will need, tagged to the days that need them.
          </p>
          <Link to="/" className="btn-primary btn-touch !px-3 text-xs">
            Plan a trip
          </Link>
        </div>
      )}

      {itinerary && !showAll && (
        <div className="card mt-4 p-4">
          <p className="label">Where each phrase earns its place</p>
          <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            {itinerary.days.map((d) => (
              <li key={d.day} className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-xs font-bold text-ink-400">D{d.day}</span>
                <span className="text-ink-500">
                  {d.base} —{' '}
                  <span className={practice ? 'text-ink-400 italic' : 'kannada text-ink-900'}>
                    {practice
                      ? `${(d.phrases || []).length} phrases waiting below`
                      : (d.phrases || []).map((id) => phraseById(id)?.kannada).filter(Boolean).join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-8">
        {kit.map((g) => (
          <section key={g.id} aria-labelledby={`grp-${g.id}`}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id={`grp-${g.id}`} className="font-display text-xl font-bold">
                {g.label}
              </h2>
              <span className="kannada text-sm text-primary-700">{g.kannada}</span>
              <span className="text-xs text-ink-400">{g.phrases.length} phrases</span>
              <button
                type="button"
                onClick={() => (playing === g.id ? stopAll() : listenAll(g))}
                className="btn-quiet btn-touch ml-auto !px-3 text-xs no-print"
                disabled={!ttsSupported()}
              >
                {playing === g.id ? '◼ Stop' : '▶ Play the set'}
              </button>
            </div>
            <ul className="min-track grid gap-3 md:grid-cols-2" key={`${g.id}-${practice}`}>
              {g.phrases.map((p, i) => (
                <PhraseCard key={p.id} phrase={p} practice={practice} index={i} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="no-print mt-10 rounded-xl bg-ink-900/[0.04] p-4 text-xs leading-relaxed text-ink-500">
        <p>
          <span className="font-semibold text-ink-700">A note on saying these.</span> Kannada is spoken, not read:
          the retroflex <span className="font-mono">t</span> and <span className="font-mono">d</span> come off the
          tongue-tip against the roof of the mouth, not the teeth. Stress the first syllable. If you get the vowel
          lengths wrong, a Kannada speaker will still understand you — and they will notice that you tried, which is
          the entire point of this page.
        </p>
      </footer>
    </div>
  )
}
