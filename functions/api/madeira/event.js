import { proxyFogos } from '../../_fogos.js'

// Adverse-weather event in progress in Madeira, from SRPC, IP-RAM via
// FogosPT GET /v2/madeira/events/current (`data: null` when there is none).
// Upstream also embeds per-parish/hourly/nature breakdowns and the top
// occurrences; we keep what the area pages render. Times are UTC instants.
// Upstream caches 60 s; FogosPT ingests SRPC every few minutes.

const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : 0)
const arr = (v) => (Array.isArray(v) ? v : [])

function trimEvent(e) {
	if (!e || typeof e !== 'object') return null
	const kpi = e.kpi ?? {}
	return {
		id: String(e.id ?? ''),
		title: str(e.title),
		zone: str(e.zone),
		status: str(e.status),
		active: e.active === true,
		start: str(e.start),
		end: str(e.end),
		untilNow: e.untilNow === true,
		updatedAt: str(e.updatedAt),
		kpi: {
			occurrences: num(kpi.occurrences),
			activeOccurrences: num(kpi.activeOccurrences),
			operationals: num(kpi.operationals),
			groundAssets: num(kpi.groundAssets),
			municipalities: num(kpi.municipalities),
			peak: kpi.peak && str(kpi.peak.time) ? { time: kpi.peak.time, occurrences: num(kpi.peak.occurrences) } : null,
		},
		summary: str(e.summary),
		recommendations: arr(e.recommendations).filter((r) => str(r)),
		municipalities: arr(e.municipalities).map((m) => ({ name: str(m?.name), occurrences: num(m?.occurrences) })),
		roadRestrictions: arr(e.roadRestrictions)
			.filter((r) => str(r?.road) || str(r?.text))
			.map((r) => ({ road: str(r.road), closed: r.closed === true, text: str(r.text), time: str(r.time) })),
		communiques: arr(e.communiques)
			.filter((c) => str(c?.title))
			.map((c) => ({ title: c.title, time: str(c.time), link: /^https?:\/\//.test(c.link ?? '') ? c.link : null, official: c.official === true })),
		notes: str(e.notes),
	}
}

export function onRequestGet({ env }) {
	return proxyFogos({
		env,
		path: '/v2/madeira/events/current',
		cacheSeconds: 120,
		label: 'madeira-event',
		transform: (data) => ({ event: trimEvent(data?.data) }),
	})
}
