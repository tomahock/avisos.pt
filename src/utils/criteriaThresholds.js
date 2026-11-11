// IPMA warning criteria (src/data/criterios.js, kept as IPMA's strings) →
// numeric thresholds for the station charts. criterios.js stays the single
// source; this module only interprets it, and criteriaThresholds.test.js pins
// every interpreted value for the 25 areas, so a badly transcribed revision
// fails the tests. DOM/React-free.
//
// Each level of a criterion becomes { level, value, strict }: where that
// level STARTS, i.e. the "weakest" end of IPMA's range —
//   • "higher is worse" (rain, wind, heat): the lower bound — "10 a 20" → ≥ 10;
//   • "lower is worse" (cold): the higher bound, whatever order IPMA wrote
//     it in — "3 a 1" → ≤ 3, and Madeira's "-2 a -1" → ≤ −1;
//   • "> x" / "< x" (always the red level) are strict: > 40, < −5.
// A value between two written ranges (20.5 mm between "10 a 20" and
// "21 a 40") counts as the lower level: IPMA writes integer classes and we
// don't invent the boundary.

import { CRITERIA_REGIONS } from '../data/criterios.js'
import { IPMA_AREAS } from '../data/ipmaAreas.js'
import { LEVELS } from '../data/levels.js'

export const THRESHOLD_LEVELS = ['yellow', 'orange', 'red']

const NUM = '(-?\\d+(?:[.,]\\d+)?)'
const RANGE = new RegExp(`^${NUM}\\s+a\\s+${NUM}$`)
const OP = new RegExp(`^(>|&gt;|<|&lt;|≥|>=|≤|<=)\\s*${NUM}$`)
const OPS = { '>': 'gt', '&gt;': 'gt', '<': 'lt', '&lt;': 'lt', '≥': 'ge', '>=': 'ge', '≤': 'le', '<=': 'le' }
const num = (s) => Number(s.replace(',', '.'))

/**
 * One IPMA criterion string → { kind: 'range', lo, hi } (lo ≤ hi, whatever
 * the written order) or { kind: 'gt'|'lt'|'ge'|'le', value }; null if it
 * isn't one of those shapes.
 */
export function parseThreshold(str) {
	const s = String(str ?? '').trim()
	let m = s.match(RANGE)
	if (m) {
		const [a, b] = [num(m[1]), num(m[2])]
		return { kind: 'range', lo: Math.min(a, b), hi: Math.max(a, b) }
	}
	m = s.match(OP)
	if (m) return { kind: OPS[m[1]], value: num(m[2]) }
	return null
}

/** Where a level starts, for a criterion where 'up' or 'down' is worse. */
export function levelStart(parsed, direction) {
	if (!parsed) return null
	if (parsed.kind === 'range') return { value: direction === 'down' ? parsed.hi : parsed.lo, strict: false }
	const ok = direction === 'down' ? ['lt', 'le'] : ['gt', 'ge']
	if (!ok.includes(parsed.kind)) return null
	return { value: parsed.value, strict: parsed.kind === 'gt' || parsed.kind === 'lt' }
}

function levelsOf(cells, direction) {
	const out = []
	THRESHOLD_LEVELS.forEach((level, i) => {
		const start = levelStart(parseThreshold(cells[i]), direction)
		if (start) out.push({ level, ...start })
	})
	return out.length === THRESHOLD_LEVELS.length ? out : null
}

/** Does `v` reach threshold `t` of a criterion with this direction? */
export function reaches(v, t, direction = 'up') {
	if (v == null || !Number.isFinite(v)) return false
	if (direction === 'down') return t.strict ? v < t.value : v <= t.value
	return t.strict ? v > t.value : v >= t.value
}

/** The worst level `v` reaches in a criterion, or null. */
export function levelReached(v, criterion) {
	if (!criterion) return null
	let worst = null
	for (const t of criterion.levels) if (reaches(v, t, criterion.direction)) worst = t.level
	return worst
}

// criterios.js region key per IPMA region.
const REGION_KEY = { continental: 'continente', madeira: 'madeira', acores: 'acores' }

/** criterios.js region of an IPMA area code, or null. */
export function criteriaRegionForArea(code) {
	const key = REGION_KEY[IPMA_AREAS[code]?.region]
	return CRITERIA_REGIONS.find((r) => r.key === key) ?? null
}

// Island rows of the temperature tables are named differently from
// IPMA_AREAS; continental rows use the district name.
const TEMPERATURE_ROW = {
	MCN: 'Costa Norte',
	MCS: 'Costa Sul',
	MRM: 'Regiões Montanhosas',
	MPS: 'Porto Santo',
	AOC: 'Grupo Ocidental',
	ACE: 'Grupo Central',
	AOR: 'Grupo Oriental',
}

/** [name, minCells, maxCells] of an area's Tempo Quente/Frio table, or null. */
export function temperatureRowForArea(code) {
	const region = criteriaRegionForArea(code)
	const name = TEMPERATURE_ROW[code] ?? IPMA_AREAS[code]?.name
	return region?.temperatures?.find(([n]) => n === name) ?? null
}

function rowsOf(region, type) {
	return region.types.find((t) => t.type === type)?.rows ?? []
}

function criterion(row, direction, extra) {
	const levels = row && levelsOf([row.yellow, row.orange, row.red], direction)
	return levels ? { direction, levels, ...extra } : null
}

/**
 * Numeric criteria for a station in IPMA area `code`:
 *   rain1h / rain6h       — mm in 1 h / 6 h
 *   windGust              — maximum gust (km/h); stations only report the
 *                           MEAN wind, so it's drawn as a reference only
 *   windMean              — mean speed (km/h), Açores only; compares directly
 *   heat / cold           — daily max / min temperature (°C), warning needs
 *                           ≥ 48 h
 * Each is { direction, levels: [{ level, value, strict }], unit, … } or null.
 * The "Nas terras altas" wind row isn't used: we can't tell whether a
 * station is in the highlands.
 */
export function stationThresholds(code) {
	const region = criteriaRegionForArea(code)
	if (!region) return null
	const rain = rowsOf(region, 'Precipitação')
	const wind = rowsOf(region, 'Vento')
	const temps = temperatureRowForArea(code)
	return {
		region: region.key,
		rain1h: criterion(rain.find((r) => r.unit === 'mm/1h'), 'up', { unit: 'mm', label: 'mm/1h' }),
		rain6h: criterion(rain.find((r) => r.unit === 'mm/6h'), 'up', { unit: 'mm', label: 'mm/6h' }),
		windGust: criterion(
			wind.find((r) => !r.note || r.note === 'Rajada máxima'),
			'up',
			{ unit: 'km/h', label: 'rajada', reference: true }
		),
		windMean: criterion(wind.find((r) => r.note === 'Velocidade média'), 'up', { unit: 'km/h', label: 'vento médio' }),
		heat: temps ? criterion({ yellow: temps[2][0], orange: temps[2][1], red: temps[2][2] }, 'up', { unit: '°C', label: 'Tempo Quente', note: 'aviso exige ≥ 48 h' }) : null,
		cold: temps ? criterion({ yellow: temps[1][0], orange: temps[1][1], red: temps[1][2] }, 'down', { unit: '°C', label: 'Tempo Frio', note: 'aviso exige ≥ 48 h' }) : null,
	}
}

/** Short name of a level ("amarelo"). */
export function levelWord(level) {
	return LEVELS[level]?.label.toLowerCase() ?? level
}

/** "> 40" / "≤ 3" / "10" — a threshold value as shown next to its line. */
export function thresholdText(t, direction = 'up') {
	const n = t.value.toLocaleString('pt-PT')
	if (t.strict) return `${direction === 'down' ? '<' : '>'} ${n}`
	return n
}
