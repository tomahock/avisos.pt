// Threshold lines on the station charts (StationChart, Sparkline): which
// criteria fit the Y scale, which lines to draw, the "fora da escala" note
// and the tooltip suffix. DOM/React-free.
//
// A "set" is one criterion drawn on a chart:
//   { key, criterion (stationThresholds() entry), name?, unit, applies? }
// `name` prefixes the line label ("rajada", "6 h"); `unit` is shown in notes
// ("mm/h"); `title` names it in the "fora da escala" note when there's no
// `name` ("Tempo Quente"); `applies` ('main' | 'overlay' | 'hi' | 'lo') says which value the
// tooltip compares (overlay = the 6 h sum, hi/lo = daily max/min).
//
// Scale rule: a set enters the Y domain only if, after stretching the domain
// to its yellow threshold, the data still fill at least half of it — for a
// chart from zero (rain, wind bars) that's "the data reach ≥ 50 % of the
// yellow threshold". Otherwise the chart isn't squashed and the caption says
// "limiar amarelo X, fora da escala". Orange/red are drawn only when they
// fall inside the resulting scale.

import { levelReached, levelWord, thresholdText } from './criteriaThresholds.js'

export const MIN_DATA_SHARE = 0.5

/**
 * → { lo, hi, included: Set(set.key), outOfScale: [set] } for data spanning
 * [lo, hi] (pass the chart's own lo/hi, e.g. 0 for bars).
 */
export function thresholdDomain(lo, hi, sets) {
	const included = new Set()
	const outOfScale = []
	let newLo = lo
	let newHi = hi
	const span = hi - lo
	for (const s of sets ?? []) {
		const yellow = s.criterion?.levels?.[0]
		if (!yellow) continue
		const l = Math.min(lo, yellow.value)
		const h = Math.max(hi, yellow.value)
		const share = h - l > 0 ? span / (h - l) : 1
		if (share >= MIN_DATA_SHARE) {
			included.add(s.key)
			newLo = Math.min(newLo, l)
			newHi = Math.max(newHi, h)
		} else {
			outOfScale.push(s)
		}
	}
	return { lo: newLo, hi: newHi, included, outOfScale }
}

// Levels of a set worth drawing: those the data already reach, plus the
// next one (the next target) — not every level up to the top of the scale.
// `extreme` = the data's max (or min, for 'down' criteria); undefined → all.
function levelsToDraw(criterion, extreme) {
	if (extreme == null) return criterion.levels
	const out = []
	for (const t of criterion.levels) {
		out.push(t)
		const beyond = criterion.direction === 'down' ? t.value < extreme : t.value > extreme
		if (beyond) break
	}
	return out
}

/**
 * Lines of the included sets that fall inside [yMin, yMax]. `extremes` maps
 * a set's `applies` ('main' | 'overlay' | 'hi' | 'lo') to { lo, hi } of the
 * data it compares with; with it, each set stops at its next level.
 */
export function thresholdLines(sets, included, yMin, yMax, extremes) {
	const out = []
	for (const s of sets ?? []) {
		if (!included.has(s.key)) continue
		const range = extremes?.[s.applies ?? 'main']
		const extreme = range ? (s.criterion.direction === 'down' ? range.lo : range.hi) : undefined
		for (const t of levelsToDraw(s.criterion, extreme)) {
			if (t.value < yMin || t.value > yMax) continue
			out.push({
				key: `${s.key}-${t.level}`,
				level: t.level,
				value: t.value,
				reference: !!s.criterion.reference,
				label: `${s.name ? `${s.name} ` : `${levelWord(t.level)} `}${thresholdText(t, s.criterion.direction)}`,
				title: `Limiar ${levelWord(t.level)}${s.criterion.label ? ` (${s.criterion.label}${s.criterion.reference ? ', referência' : ''})` : ''}: ${thresholdText(t, s.criterion.direction)} ${s.unit ?? ''}`.trim(),
			})
		}
	}
	return out
}

/** "limiar amarelo 10 mm/h, fora da escala" (one per set, joined). */
export function outOfScaleText(sets) {
	return (sets ?? [])
		.map((s) => {
			const y = s.criterion.levels[0]
			const who = s.name || s.title ? `${s.name || s.title}: ` : ''
			return `${who}limiar amarelo ${thresholdText(y, s.criterion.direction)}${s.unit ? ` ${s.unit}` : ''}, fora da escala`
		})
		.join(' · ')
}

/**
 * Tooltip suffix for a hovered point: the worst level reached by a
 * non-reference set ("≥ limiar laranja"), or null. `values` maps
 * applies → value ({ main, overlay, hi, lo }).
 */
export function reachedText(sets, values) {
	let worst = null
	const rank = { yellow: 1, orange: 2, red: 3 }
	for (const s of sets ?? []) {
		if (s.criterion.reference) continue
		const level = levelReached(values[s.applies ?? 'main'], s.criterion)
		if (level && (!worst || rank[level] > rank[worst])) worst = level
	}
	return worst ? `≥ limiar ${levelWord(worst)}` : null
}

/** Plain-text list of a chart's criteria for aria-label/title. */
export function thresholdsSummary(sets) {
	return (sets ?? [])
		.map((s) => {
			const values = s.criterion.levels.map((t) => `${levelWord(t.level)} ${thresholdText(t, s.criterion.direction)}`).join(', ')
			return `${s.criterion.label ?? ''}${s.criterion.reference ? ' (referência)' : ''}: ${values}${s.unit ? ` ${s.unit}` : ''}`.trim()
		})
		.join('; ')
}

/**
 * The threshold sets of each chart for a station's criteria
 * (stationThresholds()), or empty lists when there are none:
 *   temperatura — Tempo Quente + Tempo Frio (hourly line)
 *   range       — the same on the daily min/max bars (hi vs heat, lo vs cold)
 *   chuva       — mm/1h on the bars + mm/6h on the 6 h rolling sum
 *   vento       — gust as a reference + mean speed (Açores only)
 */
export function chartSets(t) {
	const sets = (list) => list.filter((s) => s.criterion)
	if (!t) return { temperatura: [], range: [], chuva: [], vento: [] }
	return {
		temperatura: sets([
			{ key: 'heat', criterion: t.heat, title: 'Tempo Quente', unit: '°C' },
			{ key: 'cold', criterion: t.cold, title: 'Tempo Frio', unit: '°C' },
		]),
		range: sets([
			{ key: 'heat', criterion: t.heat, title: 'Tempo Quente', unit: '°C', applies: 'hi' },
			{ key: 'cold', criterion: t.cold, title: 'Tempo Frio', unit: '°C', applies: 'lo' },
		]),
		chuva: sets([
			{ key: 'rain1h', criterion: t.rain1h, unit: 'mm/h' },
			{ key: 'rain6h', criterion: t.rain6h, name: '6 h', unit: 'mm/6h', applies: 'overlay' },
		]),
		vento: sets([
			{ key: 'gust', criterion: t.windGust, name: 'rajada', unit: 'km/h' },
			{ key: 'mean', criterion: t.windMean, unit: 'km/h' },
		]),
	}
}

// Worst level the latest reading reaches — only criteria that compare
// directly: heat/cold, mm/1h, and the Açores mean wind. Never the gust lines
// (stations only report the mean wind; gusts are a reference).
export function latestLevel(criteria, metric, value) {
	if (!criteria || value == null) return null
	if (metric === 'temperatura') return levelReached(value, criteria.heat) ?? levelReached(value, criteria.cold)
	if (metric === 'chuva') return levelReached(value, criteria.rain1h)
	if (metric === 'vento') return levelReached(value, criteria.windMean)
	return null
}

/** { lo, hi } of a list of numbers (nulls ignored), or undefined. */
export function extent(values) {
	const v = (values ?? []).filter((x) => x != null && Number.isFinite(x))
	return v.length ? { lo: Math.min(...v), hi: Math.max(...v) } : undefined
}
