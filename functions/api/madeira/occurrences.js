import { proxyFogos } from '../../_fogos.js'

// Occurrences of the last 24 h registered by SRPC, IP-RAM (Madeira), from
// FogosPT GET /v2/madeira/occurrences (newest first; without `from` upstream
// returns the last 24 h). No status and no exact location: `lat`/`lng` are
// the parish centroid (FogosPT/fogosapi#101 — absent until it's deployed).
// We drop `entities`/`updatedAt`/`location`. Times are UTC instants.

const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)
const coord = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const int = (v) => (Number.isFinite(Number(v)) && v !== null ? Math.max(0, Math.round(Number(v))) : 0)

function trimOccurrence(o) {
	const lat = coord(o.lat)
	const lng = coord(o.lng)
	const located = lat !== null && lng !== null && (o.location === undefined || o.location === 'parish')
	return {
		id: String(o.id ?? ''),
		copies: Math.max(1, int(o.copies)),
		start: str(o.start),
		natureCode: o.natureCode == null ? null : String(o.natureCode),
		nature: str(o.nature),
		firefighters: int(o.firefighters),
		vehicles: int(o.vehicles),
		parishCode: o.parishCode == null ? null : String(o.parishCode),
		parish: str(o.parish),
		municipalityCode: o.municipalityCode == null ? null : String(o.municipalityCode),
		municipality: str(o.municipality),
		lat: located ? lat : null,
		lng: located ? lng : null,
	}
}

export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/madeira/occurrences?limit=2000',
		cacheSeconds: 120,
		label: 'madeira-occurrences',
		transform: (data) => (Array.isArray(data?.data) ? data.data : []).filter((o) => o && typeof o === 'object').map(trimOccurrence),
	})
}
