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

const WIND_DIR = {
	0: null, // no wind
	1: 'N',
	2: 'NE',
	3: 'E',
	4: 'SE',
	5: 'S',
	6: 'SW',
	7: 'W',
	8: 'NW',
	9: 'N',
}

export function formatWind(kmh, dirId) {
	if (!isValid(kmh)) return null
	const rounded = Math.round(kmh)
	const dir = WIND_DIR[dirId]
	return dir ? `${rounded} km/h ${dir}` : `${rounded} km/h`
}

// FogosPT warning times: ISO-8601 without timezone, interpreted as local PT.
export function formatWhen(iso) {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString('pt-PT', {
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
