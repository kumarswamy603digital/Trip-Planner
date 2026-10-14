/** Presentation helpers shared by the itinerary, map and export views. */

export const DAY_COLORS = ['#9B2226', '#CA6702', '#2A9D8F', '#588157', '#7B2CB2', '#1D3557', '#B2402A']

export const dayColor = (dayNumber) => DAY_COLORS[(Number(dayNumber) - 1 || 0) % DAY_COLORS.length]

export const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export const CATEGORY_META = {
  heritage: { label: 'Heritage', emoji: '🏛️', tone: 'bg-ochre-50 text-ochre-700 ring-ochre-200' },
  spiritual: { label: 'Temple', emoji: '🪔', tone: 'bg-primary-50 text-primary-700 ring-primary-100' },
  nature: { label: 'Nature', emoji: '🌿', tone: 'bg-forest-50 text-forest-600 ring-forest-100' },
  food: { label: 'Food', emoji: '🍛', tone: 'bg-sand-100 text-ink-700 ring-sand-300' },
  beaches: { label: 'Beach', emoji: '🌊', tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
  adventure: { label: 'Adventure', emoji: '🧗', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' }
}

export const catMeta = (c) => CATEGORY_META[c] || { label: c, emoji: '📍', tone: 'bg-ink-100 text-ink-700 ring-ink-200' }

export const BLOCK_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }

export const TIME_FOR_DAY = {
  1: 'One day is enough to taste one corner of the state properly.',
  2: 'A weekend — short, but Karnataka rewards it.',
  3: 'Three days: one region, slowly, with room to detour.',
  4: 'Four days lets the plan cross into a second region.',
  5: 'Five days — the classic North Karnataka heritage loop fits here.',
  6: 'Six days: hills, coast and heritage without rushing any of them.',
  7: 'A full week. This is the deep Karnataka route.'
}
