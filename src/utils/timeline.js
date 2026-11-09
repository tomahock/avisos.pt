import { LEVELS } from '../data/levels.js'

const HOUR = 3600 * 1000

// Timeline window: hourly slots from the current hour up to the last
// warning's endTime. FogosPT only returns warnings with endTime >= now, so
// there is nothing to show in the past. Clamped to [MIN_HOURS, MAX_HOURS] so
// the grid never collapses to a few cells nor runs off for a week.
const MIN_HOURS = 48
const MAX_HOURS = 96

export function floorHour(d) {
	const t = new Date(d)
	t.setMinutes(0, 0, 0)
	return t
}

export function buildHours(warnings, now = new Date()) {
	const start = floorHour(now).getTime()
	let end = start + MIN_HOURS * HOUR
	for (const w of warnings) {
		const e = new Date(w.endTime).getTime()
		if (Number.isFinite(e) && e > end) end = e
	}
	end = Math.min(end, start + MAX_HOURS * HOUR)
	const count = Math.ceil((end - start) / HOUR)
	return Array.from({ length: count }, (_, i) => new Date(start + i * HOUR))
}

// Warnings overlapping the slot [hour, hour + 1h).
export function warningsAt(warnings, hour) {
	const s = hour.getTime()
	const e = s + HOUR
	return warnings.filter(
		(w) =>
			new Date(w.startTime).getTime() < e && new Date(w.endTime).getTime() > s
	)
}

// Worst awarenessLevelID active during the slot, or null.
export function worstAt(warnings, hour) {
	let worst = null
	let pri = 0
	for (const w of warningsAt(warnings, hour)) {
		const p = LEVELS[w.awarenessLevelID]?.priority ?? 0
		if (p > pri) {
			pri = p
			worst = w.awarenessLevelID
		}
	}
	return worst
}

// Group consecutive hours into calendar days for the header row.
export function groupDays(hours) {
	const days = []
	for (const h of hours) {
		const key = h.toDateString()
		const last = days[days.length - 1]
		if (last && last.key === key) last.span++
		else days.push({ key, date: h, span: 1 })
	}
	return days
}

export function dayLabel(date, now = new Date()) {
	const diff = Math.round(
		(floorDay(date).getTime() - floorDay(now).getTime()) / (24 * HOUR)
	)
	const weekday = date.toLocaleDateString('pt-PT', { weekday: 'short' })
	const dm = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
	if (diff === 0) return { main: 'Hoje', sub: `${weekday}, ${dm}` }
	if (diff === 1) return { main: 'Amanhã', sub: `${weekday}, ${dm}` }
	return { main: capitalize(weekday.replace('.', '')), sub: dm }
}

function floorDay(d) {
	const t = new Date(d)
	t.setHours(0, 0, 0, 0)
	return t
}

function capitalize(s) {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatHour(d) {
	return String(d.getHours()).padStart(2, '0')
}

// "começa em 3 h" / "termina em 40 min" / "terminou".
export function relativeWindow(w, now = new Date()) {
	const s = new Date(w.startTime).getTime()
	const e = new Date(w.endTime).getTime()
	const t = now.getTime()
	if (t < s) return { active: false, text: `começa ${inDuration(s - t)}` }
	if (t < e) return { active: true, text: `termina ${inDuration(e - t)}` }
	return { active: false, text: 'terminou' }
}

function inDuration(ms) {
	const mins = Math.round(ms / 60000)
	if (mins < 60) return `em ${mins} min`
	const hours = Math.round(mins / 60)
	if (hours < 48) return `em ${hours} h`
	return `em ${Math.round(hours / 24)} dias`
}

export function durationHours(w) {
	return Math.round(
		(new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / HOUR
	)
}
