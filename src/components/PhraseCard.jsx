import React, { useEffect, useRef, useState } from 'react'
import { hasKannadaVoice, speak, stopSpeaking, ttsSupported } from '@/lib/tts'

const TAG_TONE = {
  greeting: 'bg-primary-50 text-primary-700 ring-primary-100',
  directions: 'bg-forest-50 text-forest-600 ring-forest-100',
  transport: 'bg-ochre-50 text-ochre-700 ring-ochre-200',
  food: 'bg-sand-100 text-ink-700 ring-sand-300',
  market: 'bg-sand-100 text-ink-700 ring-sand-300',
  temple: 'bg-primary-50 text-primary-700 ring-primary-100',
  emergency: 'bg-red-50 text-red-700 ring-red-200'
}

/**
 * FR-6: Kannada script, romanisation, meaning, and a voice. In practice mode the
 * Kannada is hidden until the traveller has said it out loud — recall, not recognition.
 */
export default function PhraseCard({ phrase, practice = false, index = 0 }) {
  const [heard, setHeard] = useState(!practice)
  const [speaking, setSpeaking] = useState(false)
  const timer = useRef(null)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      stopSpeaking()
    },
    []
  )

  const listen = (slow = false) => {
    setSpeaking(true)
    const ok = speak(phrase.kannada, {
      lang: phrase.audioLang || 'kn-IN',
      rate: slow ? 0.62 : 0.82,
      onEnd: () => setSpeaking(false)
    })
    if (!ok) setSpeaking(false)
    // safety net: some engines never fire onend
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSpeaking(false), 6000)
  }

  return (
    <li className="card card-hover p-4 print-block">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-xs font-bold text-ink-400">{String(index + 1).padStart(2, '0')}</span>

        <div className="min-w-0 flex-1">
          {practice && !heard ? (
            <button
              type="button"
              onClick={() => setHeard(true)}
              className="w-full min-h-[2.75rem] rounded-lg bg-ink-900/[0.04] px-3 py-2 text-left text-sm text-ink-500 hover:bg-ink-900/[0.07]"
              title="Say it out loud, then check"
            >
              <span className="font-semibold text-ink-700">{phrase.english}</span>
              <span className="ml-2 text-xs">— tap to reveal the Kannada</span>
            </button>
          ) : (
            <>
              <p className="kannada text-xl font-semibold leading-snug text-ink-900">{phrase.kannada}</p>
              <p className="phonetic mt-0.5">{phrase.phonetic}</p>
              <p className="text-sm text-ink-500">{phrase.english}</p>
            </>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {phrase.tags.map((t) => (
              <span key={t} className={`chip ${TAG_TONE[t] || 'bg-ink-100 text-ink-700 ring-ink-200'} !px-2 !py-0.5 !text-[11px]`}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => listen(false)}
            disabled={!ttsSupported()}
            className="btn-primary !h-11 !w-11 !p-0"
            title={ttsSupported() ? 'Listen in Kannada' : 'This browser has no speech voice installed'}
            aria-label={`Listen to ${phrase.english}`}
          >
            {speaking ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 10v4h3l4 3V7L8 10H5Z" strokeLinejoin="round" />
                <path d="M16 9a4 4 0 0 1 0 6" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => listen(true)}
            disabled={!ttsSupported()}
            className="btn-ghost !px-2 !py-1 text-[11px] font-bold min-h-[2.5rem]"
            title="Hear it slowly, syllable by syllable"
          >
            slow
          </button>
        </div>
      </div>

      {practice && !heard && ttsSupported() && (
        <button type="button" onClick={() => listen(true)} className="btn-quiet btn-touch mt-2 !px-3 text-xs">
          Hear it first, then guess
        </button>
      )}
    </li>
  )
}

export function VoiceNote() {
  if (!ttsSupported()) {
    return (
      <p className="rounded-xl bg-ochre-50 p-3 text-xs leading-relaxed text-ochre-700 ring-1 ring-ochre-100">
        This browser has no speech voices, so the listen buttons are idle. The phonetics are written to be read
        aloud as they are — say them anyway; Kannada speakers will understand you.
      </p>
    )
  }
  if (!hasKannadaVoice()) {
    return (
      <p className="rounded-xl bg-sand-100 p-3 text-xs leading-relaxed text-ink-600 ring-1 ring-sand-300">
        No Kannada voice is installed on this device, so playback uses the nearest available voice. Install one (or
        use Chrome/Edge on desktop) for true pronunciation; the phonetics stay exact either way.
      </p>
    )
  }
  return null
}
