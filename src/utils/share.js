// URLs + share/SEO copy for districts and individual warnings.
//
// Imported by BOTH the browser bundle and the Pages Functions (middleware +
// OG images), so it must stay free of DOM/React and produce identical text on
// both sides. Times in share copy are always Europe/Lisbon — the text ends up
// in WhatsApp/Facebook previews read by people in any timezone, and Portuguese
// civil-protection communication uses Lisbon time.

import { IPMA_AREAS } from '../data/ipmaAreas.js'
import { LEVELS, worstLevelId } from '../data/levels.js'
import { typeRank } from '../data/warningTypes.js'
import { parseWarningTime } from './format.js'

export const SITE_URL = 'https://avisos.pt'
export const SITE_NAME = 'Avisos.pt'

export const DEFAULT_META = {
	title: 'Avisos.pt — Avisos meteorológicos em vigor em Portugal',
	description:
		'Consulta em tempo real os avisos meteorológicos amarelos, laranja e vermelhos emitidos pelo IPMA para todos os distritos de Portugal, com leituras actuais das estações meteorológicas.',
}

// Title/description per static route — used by the SSR middleware and the
// pages themselves, so the head never flips after hydration.
export const PAGE_META = {
	'/cronologia': {
		title: 'Cronologia dos avisos meteorológicos, hora a hora',
		description:
			'Linha temporal hora a hora dos avisos meteorológicos do IPMA para cada distrito e região de Portugal: quando começam, quando terminam e o nível em cada hora.',
	},
	'/mapa': {
		title: 'Mapa dos avisos meteorológicos em Portugal',
		description:
			'Mapa dos avisos meteorológicos do IPMA em Portugal continental, Açores e Madeira, para agora e para os próximos dias, com estações meteorológicas.',
	},
	'/criterios': {
		title: 'Critérios de emissão de avisos meteorológicos do IPMA',
		description:
			'Quando é que o IPMA emite um aviso amarelo, laranja ou vermelho? Limiares de vento, chuva, neve, trovoada, nevoeiro, calor, frio e agitação marítima, por distrito.',
	},
}

export function slugify(s) {
	return String(s)
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

export function districtPath(code) {
	const area = IPMA_AREAS[code]
	return area ? `/distrito/${area.slug}` : '/'
}

// Stable per-warning id: type + start as Lisbon wall-clock, taken straight
// from the API string (no Date parsing, so browser and server always agree).
// FogosPT has no warning id; a level change on the same window keeps the URL.
export function warningSlug(w) {
	const m = String(w.startTime).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
	const when = m ? `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}` : slugify(w.startTime)
	return `${slugify(w.awarenessTypeName)}-${when}`
}

export function warningPath(w) {
	return `${districtPath(w.idAreaAviso)}/aviso/${warningSlug(w)}`
}

export function areaWarnings(warnings, code) {
	return warnings.filter((w) => w.idAreaAviso === code)
}

// Resolve /distrito/:slug/aviso/:id. Two entries with the same id (shouldn't
// happen) resolve to the worst level.
export function findWarning(warnings, code, id) {
	const matches = areaWarnings(warnings, code).filter((w) => warningSlug(w) === id)
	if (matches.length === 0) return null
	const worst = worstLevelId(matches)
	return matches.find((w) => w.awarenessLevelID === worst)
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const lisbonParts = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Lisbon',
	hourCycle: 'h23',
	day: 'numeric',
	month: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
})

// "9 nov, 18:00" in Lisbon time. Built by hand from numeric parts because
// pt-PT month names differ between ICU builds (browser vs workerd), and this
// text must be identical on server and client.
export function formatLisbon(iso) {
	const ts = parseWarningTime(iso)
	if (!Number.isFinite(ts)) return iso
	return formatLisbonInstant(ts)
}

export function formatLisbonInstant(ts) {
	const p = {}
	for (const { type, value } of lisbonParts.formatToParts(new Date(ts))) p[type] = value
	return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]}, ${p.hour}:${p.minute}`
}

export function formatRange(w, sep = '→') {
	return `${formatLisbon(w.startTime)} ${sep} ${formatLisbon(w.endTime)}`
}

export function levelLabel(id) {
	return LEVELS[id]?.label ?? id
}

// "Aviso laranja de Agitação Marítima"
export function warningHeadline(w) {
	return `Aviso ${levelLabel(w.awarenessLevelID).toLowerCase()} de ${w.awarenessTypeName}`
}

// Group a district's warnings into "laranja: Agitação Marítima; amarelo:
// Precipitação, Trovoada", worst level first.
function summarizeByLevel(list) {
	const byLevel = new Map()
	for (const w of list) {
		const set = byLevel.get(w.awarenessLevelID) ?? new Set()
		set.add(w.awarenessTypeName)
		byLevel.set(w.awarenessLevelID, set)
	}
	return [...byLevel.entries()]
		.sort((a, b) => (LEVELS[b[0]]?.priority ?? 0) - (LEVELS[a[0]]?.priority ?? 0))
		.map(([lvl, types]) => `${levelLabel(lvl).toLowerCase()} de ${[...types].join(', ')}`)
}

export function districtSeo(code, warnings) {
	const area = IPMA_AREAS[code]
	const name = area?.name ?? code
	const list = warnings ? areaWarnings(warnings, code) : null
	const title = `Avisos meteorológicos para ${name}`
	let description
	if (list === null) {
		description = `Avisos meteorológicos do IPMA em vigor para ${name}, hora a hora, com observações das estações meteorológicas.`
	} else if (list.length === 0) {
		description = `Sem avisos meteorológicos para ${name} neste momento. Acompanhe os avisos do IPMA hora a hora em Avisos.pt.`
	} else {
		const lastEnd = list.reduce((a, w) => (parseWarningTime(w.endTime) > parseWarningTime(a.endTime) ? w : a))
		description = `${list.length === 1 ? 'Aviso' : `${list.length} avisos`}: ${summarizeByLevel(list).join('; ')}. Até ${formatLisbon(lastEnd.endTime)}.`
	}
	return {
		title,
		description,
		path: districtPath(code),
		worst: list ? worstLevelId(list) : null,
	}
}

export function warningSeo(w) {
	const name = IPMA_AREAS[w.idAreaAviso]?.name ?? w.idAreaAviso
	return {
		title: `${warningHeadline(w)} — ${name}`,
		description: `${formatRange(w)}. ${w.text ?? ''}`.trim(),
		path: warningPath(w),
		worst: w.awarenessLevelID,
	}
}

// Changes whenever the warnings that a card depends on change, so social
// networks (which cache og:image per URL) fetch a fresh image.
export function warningsVersion(list) {
	let h = 0
	const s = list
		.map((w) => `${w.idAreaAviso}|${w.awarenessTypeName}|${w.awarenessLevelID}|${w.startTime}|${w.endTime}`)
		.sort()
		.join(';')
	for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
	return (h >>> 0).toString(36)
}

// Chronological, then IPMA legend order for warnings starting together.
export function sortWarnings(list) {
	return [...list].sort(
		(a, b) =>
			parseWarningTime(a.startTime) - parseWarningTime(b.startTime) ||
			typeRank(a.awarenessTypeName) - typeRank(b.awarenessTypeName)
	)
}
