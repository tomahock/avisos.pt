// /historico: URL ⇄ FogosPT /v2/warnings/ipma/history query, and grouping.
// DOM/React-free (tested with node --test).

import { codeFromSlug } from '../data/ipmaAreas.js'
import { WARNING_TYPE_NAMES } from '../data/warningTypes.js'
import { parseWarningTime } from './format.js'
import { slugify } from './share.js'

// Display order of the event filters. `texto_alterado` is stored upstream but
// deliberately never shown.
export const HISTORY_KINDS = {
	agravado: { label: 'Agravado' },
	desagravado: { label: 'Desagravado' },
	emitido: { label: 'Emitido' },
	prolongado: { label: 'Prolongado' },
	encurtado: { label: 'Encurtado' },
	retirado: { label: 'Retirado' },
	terminado: { label: 'Terminado' },
}

export const HISTORY_PERIODS = [
	{ id: '24h', hours: 24, label: '24 horas' },
	{ id: '3d', hours: 72, label: '3 dias' },
	{ id: '7d', hours: 168, label: '7 dias' },
	{ id: '30d', hours: 720, label: '30 dias' },
]
export const DEFAULT_PERIOD = '7d'

// Upstream refuses more than 31 days.
const MAX_DAYS = 31
const DAY_MS = 86_400_000

const lisbonParts = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Lisbon',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23',
})

// Instant → "YYYY-MM-DDTHH:MM:SS" Lisbon wall-clock (the API's convention).
export function lisbonIso(ts) {
	const p = {}
	for (const { type, value } of lisbonParts.formatToParts(new Date(ts))) p[type] = value
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}

const TYPE_BY_SLUG = Object.fromEntries(WARNING_TYPE_NAMES.map((n) => [slugify(n), n]))

export function typeFromSlug(slug) {
	return TYPE_BY_SLUG[slug] ?? null
}

function isDay(s) {
	return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
}

function shiftDay(day, days) {
	return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function list(searchParams, name) {
	return (searchParams.get(name) ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
}

// URL search params (?regiao=&tipo=&evento=&periodo=&de=&ate=) → API params.
export function historyQuery(searchParams, now = new Date()) {
	const area = list(searchParams, 'regiao').map(codeFromSlug).filter(Boolean)
	const type = list(searchParams, 'tipo').map(typeFromSlug).filter(Boolean)
	const kind = list(searchParams, 'evento').filter((k) => k in HISTORY_KINDS)

	let from
	let to
	const de = searchParams.get('de')
	const ate = searchParams.get('ate')
	if (isDay(de) || isDay(ate)) {
		to = isDay(ate) ? ate : lisbonIso(now).slice(0, 10)
		from = isDay(de) ? de : shiftDay(to, -7)
		if (from > to) [from, to] = [to, from]
		if (shiftDay(from, MAX_DAYS) < to) from = shiftDay(to, -MAX_DAYS)
	} else {
		const period = HISTORY_PERIODS.find((p) => p.id === searchParams.get('periodo')) ??
			HISTORY_PERIODS.find((p) => p.id === DEFAULT_PERIOD)
		to = lisbonIso(now.getTime())
		from = lisbonIso(now.getTime() - period.hours * 3_600_000)
	}

	return { from, to, area, type, kind }
}

// API query string for the proxy.
export function historyApiSearch({ from, to, area, type, kind }) {
	const p = new URLSearchParams({ from, to })
	if (area.length) p.set('area', area.join(','))
	if (type.length) p.set('type', type.join(','))
	if (kind.length) p.set('kind', kind.join(','))
	return p.toString()
}

function localDay(ts) {
	const d = new Date(ts)
	const pad = (n) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Events → [{ day: 'YYYY-MM-DD' (visitor-local), events }], newest first.
export function groupEventsByDay(events) {
	const sorted = [...events]
		.map((e) => ({ e, ts: parseWarningTime(e.occurredAt) }))
		.filter(({ ts }) => Number.isFinite(ts))
		.sort((a, b) => b.ts - a.ts)
	const groups = []
	for (const { e, ts } of sorted) {
		const day = localDay(ts)
		const last = groups[groups.length - 1]
		if (last?.day === day) last.events.push(e)
		else groups.push({ day, events: [e] })
	}
	return groups
}
