/**
 * Kannada audio via the Web Speech API — no mp3 files, no cloud voice, works offline
 * on most desktop browsers that ship a kn-IN voice.
 */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

let voices = []

function refresh() {
  if (!synth) return
  voices = synth.getVoices() || []
}

if (synth) {
  refresh()
  synth.onvoiceschanged = refresh
}

export function ttsSupported() {
  return !!synth && typeof SpeechSynthesisUtterance !== 'undefined'
}

/** True when a real Kannada voice is installed; otherwise we fall back to a generic voice. */
export function hasKannadaVoice() {
  refresh()
  return voices.some((v) => (v.lang || '').toLowerCase().startsWith('kn'))
}

function pickVoice(lang) {
  refresh()
  const want = (lang || 'kn-IN').toLowerCase()
  return (
    voices.find((v) => (v.lang || '').toLowerCase() === want) ||
    voices.find((v) => (v.lang || '').toLowerCase().startsWith(want.split('-')[0])) ||
    voices.find((v) => (v.lang || '').toLowerCase().startsWith('hi')) ||
    null
  )
}

/**
 * Speak Kannada script slowly enough for a learner to repeat it.
 * @param {string} text  Kannada (or romanised) text
 * @param {object} opts  { lang, rate, onEnd }
 */
export function speak(text, { lang = 'kn-IN', rate = 0.82, onEnd } = {}) {
  if (!ttsSupported() || !text) {
    onEnd?.()
    return false
  }
  try {
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice(lang)
    if (voice) u.voice = voice
    u.lang = voice?.lang || lang
    u.rate = rate
    u.pitch = 1
    u.onend = () => onEnd?.()
    u.onerror = () => onEnd?.()
    synth.speak(u)
    return true
  } catch {
    onEnd?.()
    return false
  }
}

export function stopSpeaking() {
  if (synth) {
    try {
      synth.cancel()
    } catch {
      /* nothing queued */
    }
  }
}
