// IPMA/FogosPT observation sentinel for "no reading". Never treat as a value.
const MISSING = -99

export function isValid(v) {
	return typeof v === 'number' && v !== MISSING && Number.isFinite(v)
}

export function formatTemp(v) {
	return isValid(v) ? `${Math.round(v)}°C` : null
}

export function formatHumidity(v) {
	return isValid(v) ? `${Math.round(v)}%` : null
}

export function formatPrecip(v) {
	return isValid(v) ? `${v.toFixed(1).replace(/\.0$/, '')} mm` : null
}

// Portuguese compass letters (O = oeste).
const WIND_DIR = {
	0: null, // no wind
	1: 'N',
	2: 'NE',
	3: 'E',
	4: 'SE',
	5: 'S',
	6: 'SO',
	7: 'O',
	8: 'NO',
	9: 'N',
}

export function windDir(id) {
	return WIND_DIR[id] ?? null
}

export function formatWind(kmh, dirId) {
	if (!isValid(kmh)) return null
	const rounded = Math.round(kmh)
	const dir = WIND_DIR[dirId]
	return dir ? `${rounded} km/h ${dir}` : `${rounded} km/h`
}

// FogosPT timestamps are ISO without a timezone, as Lisbon wall-clock time.
// `new Date(iso)` would read them in the visitor's timezone, shifting every
// warning for anyone outside Portugal — resolve them to absolute instants
// against Europe/Lisbon instead, and only localize when displaying.
const SOURCE_TZ = 'Europe/Lisbon'
const tzParts = new Intl.DateTimeFormat('en-US', {
	timeZone: SOURCE_TZ,
	hourCycle: 'h23',
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	hour: 'numeric',
	minute: 'numeric',
	second: 'numeric',
})

// Offset (ms) of SOURCE_TZ from UTC at instant `ts`.
function tzOffset(ts) {
	const p = {}
	for (const { type, value } of tzParts.formatToParts(new Date(ts))) p[type] = +value
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ts
}

const cache = new Map()

export function parseWarningTime(iso) {
	if (typeof iso !== 'string') return NaN
	let ts = cache.get(iso)
	if (ts !== undefined) return ts
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
	if (!m || /(Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
		ts = new Date(iso).getTime()
	} else {
		const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
		// Two passes so instants next to a DST switch pick the right offset.
		ts = wall - tzOffset(wall)
		ts = wall - tzOffset(ts)
	}
	cache.set(iso, ts)
	return ts
}

// Warning time as the visitor's local "dd/mm, HH:MM". Goes through
// parseWarningTime so a visitor outside Portugal continental sees the same
// instant as /cronologia, not the raw Lisbon wall-clock digits.
export function formatWhen(iso) {
	const ts = parseWarningTime(iso)
	if (!Number.isFinite(ts)) return iso
	return new Date(ts).toLocaleString('pt-PT', {
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

// Human "há X min" from a Date.
export function relativeMinutes(from, to = new Date()) {
	const mins = Math.max(0, Math.round((to - from) / 60000))
	if (mins < 1) return 'agora mesmo'
	if (mins === 1) return 'há 1 min'
	if (mins < 60) return `há ${mins} min`
	const hours = Math.round(mins / 60)
	if (hours === 1) return 'há 1 h'
	return `há ${hours} h`
}
