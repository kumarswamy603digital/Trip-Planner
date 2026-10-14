/**
 * Export (FR-8): clipboard for WhatsApp, .txt for notes, print-to-PDF for everything else.
 * No PDF library — the browser's own print engine gives a cleaner document than a
 * canvas dump, and it costs 40 kB we would rather spend on the map.
 */
import { phraseById } from './itineraryEngine'

const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export function itineraryToText(it) {
  const lines = []
  lines.push(`NAMMA YATRI — ${it.dayCount}-day Karnataka trip from ${it.startCity}`)
  lines.push(`${it.tierLabel} budget · ${it.interests.join(', ')} · total ${INR(it.totalCost)}`)
  lines.push('')

  it.days.forEach((d) => {
    lines.push(`DAY ${d.day} — ${d.base} (${d.region})`)
    if (d.travelLeg && d.travelLeg.km > 3) {
      lines.push(`  Drive: ${d.travelLeg.km} km, about ${d.travelLeg.hours} h — ${d.travelLeg.note}`)
    }
    d.stops.forEach((s) => {
      const p = s.place
      lines.push(`  ${s.startAt}  ${p.name}${p.kannada ? ` (${p.kannada})` : ''}`)
      lines.push(`           ${p.category.join(' · ')} · ${s.durationHrs}h · entry ${INR(s.estCost)}`)
      if (p.desc) lines.push(`           ${p.desc}`)
      if (s.why) lines.push(`           ${s.why}`)
      lines.push(`           ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`)
    })
    lines.push(`  Getting around: ${d.gettingAround}`)
    const b = d.breakdown
    lines.push(
      `  Cost: ${INR(d.dayCost)} — entry ${INR(b.entry)}, local travel ${INR(b.localTransport)}, food & stay ${INR(b.foodStay)}, experiences ${INR(b.experiences)}`
    )
    if (d.narration) lines.push(`  ${d.narration}`)
    lines.push('')
  })

  lines.push('KANNADA SURVIVAL KIT')
  it.phraseIds.forEach((id) => {
    const p = phraseById(id)
    if (p) lines.push(`  ${p.kannada}   [${p.phonetic}]   ${p.english}`)
  })
  lines.push('')
  lines.push('Planned with NammaYatri AI · offline-first · no account, no tracking')
  return lines.join('\n')
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens the print dialog with the trip document; "Save as PDF" is the browser's job. */
export function printItinerary(it) {
  const prev = document.title
  document.title = `NammaYatri — ${it.dayCount}-day trip from ${it.startCity}`
  window.print()
  setTimeout(() => (document.title = prev), 800)
}

export function shareTarget(it) {
  const text = `${it.dayCount}-day Karnataka trip from ${it.startCity} — ${it.days
    .map((d) => d.base)
    .join(' → ')}`
  return { url: window.location.href, text }
}
