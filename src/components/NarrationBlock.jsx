import React, { useCallback, useEffect, useRef, useState } from 'react'
import { narrate } from '@/lib/narrationService'
import { speak, stopSpeaking, ttsSupported } from '@/lib/tts'

/**
 * One paragraph of guide prose + the two things a traveller does with it:
 * read it, or have it read aloud. The template text is always there; the AI pass is
 * an upgrade the user asks for, and silence from the network changes nothing (NFR-5).
 */
export default function NarrationBlock({ template, payload }) {
  const base = template
  const [text, setText] = useState(base)
  const [source, setSource] = useState('template') // template | loading | ai | cache
  const [speaking, setSpeaking] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stopSpeaking()
      setSpeaking(false)
    }
  }, [])

  // the plan changed under us (regenerate) — drop the AI layer and show the new truth
  useEffect(() => {
    setText(base)
    setSource('template')
  }, [base])

  const ask = useCallback(async () => {
    setSource('loading')
    const res = await narrate(payload, base)
    if (!mounted.current) return
    if (res.text) {
      setText(res.text)
      setSource(res.source)
    } else {
      setText(base)
      setSource('template')
    }
  }, [payload, base])

  const read = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    const ok = speak(text, { lang: 'en-IN', rate: 0.95, onEnd: () => mounted.current && setSpeaking(false) })
    if (!ok) setSpeaking(false)
  }

  return (
    <div className="rounded-xl bg-sand-100/70 p-4 ring-1 ring-ink-900/5 print-block">
      <div className="flex items-center gap-2">
        <p className="label flex-1">
          {source === 'ai' || source === 'cache' ? 'Your guide, today' : 'Local guide note'}
        </p>
        {(source === 'ai' || source === 'cache') && (
          <span className="badge bg-forest-50 text-forest-600 ring-1 ring-forest-100">AI · same plan</span>
        )}
      </div>

      <p className={`mt-2 text-[15px] leading-relaxed text-ink-800 ${source === 'loading' ? 'animate-pulse-soft' : ''}`}>
        {source === 'loading' ? 'Asking the guide for the colour of the day…' : text}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {source === 'template' && (
          <button type="button" onClick={ask} className="btn-ghost btn-touch !px-3 text-xs" disabled={source === 'loading'}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3l1.8 4.9L18.7 9l-4.9 1.8L12 15.7l-1.8-4.9L5.3 9l4.9-1.8L12 3Z" strokeLinejoin="round" />
            </svg>
            Rewrite with AI
          </button>
        )}
        {source !== 'template' && (
          <button type="button" onClick={() => { setText(base); setSource('template') }} className="btn-quiet btn-touch !px-3 text-xs">
            Show guide note
          </button>
        )}
        {ttsSupported() && (
          <button type="button" onClick={read} className="btn-quiet btn-touch !px-3 text-xs" aria-live="polite">
            {speaking ? '◼ Stop' : '▶ Read aloud'}
          </button>
        )}
      </div>
    </div>
  )
}
