// Which measure to show for a district's stations, driven by its warnings.

import { LEVELS } from '../data/levels.js'
import { typeRank } from '../data/warningTypes.js'
import { parseWarningTime } from './format.js'

export const STATION_METRICS = {
	temperatura: { label: 'Temperatura', field: 'temperatura', kind: 'line' },
	chuva: { label: 'Chuva', field: 'precAcumulada', kind: 'bar' },
	vento: { label: 'Vento', field: 'intensidadeVentoKM', kind: 'line' },
	humidade: { label: 'Humidade', field: 'humidade', kind: 'line' },
}

// Warning type → the station measure that best shows it. Types not listed
// don't influence the choice — including Agitação Marítima: stations don't
// measure waves, and mapping it to wind made it win over a concurrent rain
// warning (IPMA legend order puts it first).
const METRIC_FOR_TYPE = {
	'Precipitação': 'chuva',
	'Trovoada': 'chuva',
	'Vento': 'vento',
	'Tempo Quente': 'temperatura',
	'Tempo Frio': 'temperatura',
	'Neve': 'temperatura',
	'Nevoeiro': 'humidade',
}

const DAY = 24 * 3600 * 1000

// How soon a warning matters: 2 = in force now, 1 = starts within 24 h,
// 0 = later. A rain warning starting tonight beats an orange wind warning
// two days out.
function urgency(w, t) {
	const start = parseWarningTime(w.startTime)
	const end = parseWarningTime(w.endTime)
	if (start <= t && t < end) return 2
	if (start > t && start - t <= DAY) return 1
	return 0
}

// Default measure for a district: the warning that matters most decides —
// sooner beats later (urgency), then higher level, then IPMA legend order.
// No relevant warning → temperature. Returns { metric, warning|null }.
export function defaultStationMetric(warnings, now = new Date()) {
	const t = now.getTime()
	let best = null
	let bestKey = null
	for (const w of warnings ?? []) {
		const metric = METRIC_FOR_TYPE[w.awarenessTypeName]
		if (!metric) continue
		const key = [urgency(w, t), LEVELS[w.awarenessLevelID]?.priority ?? 0, -typeRank(w.awarenessTypeName)]
		const better = !bestKey || key[0] - bestKey[0] || key[1] - bestKey[1] || key[2] - bestKey[2]
		if (!bestKey || better > 0) {
			best = w
			bestKey = key
		}
	}
	return best ? { metric: METRIC_FOR_TYPE[best.awarenessTypeName], warning: best } : { metric: 'temperatura', warning: null }
}

// Sum of hourly rain with its coverage. Missing hours are unknown, not dry:
// `total` is a lower bound whenever `missing > 0`, and null when no hour has a
// reading at all.
export function rainTotal(values) {
	let total = 0
	let measured = 0
	for (const v of values) {
		if (v == null) continue
		total += v
		measured++
	}
	return { total: measured ? total : null, measured, missing: values.length - measured }
}
