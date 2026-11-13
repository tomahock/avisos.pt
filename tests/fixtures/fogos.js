// Routes of the fake FogosPT API over makeFixtures() data. Used by the E2E
// mock server and, in-process, by the component tests.

export function fogosRoute(fx, url) {
	const u = new URL(url, 'http://fogos.test')
	const p = u.pathname
	const q = u.searchParams
	if (p === '/v2/warnings/ipma') return { status: 200, body: fx.warnings }
	// `peninsula` is accepted and ignored: the fixtures are all peninsular.
	if (p === '/v2/warnings/aemet') return { status: 200, body: fx.aemetWarnings ?? [] }
	if (p === '/v2/warnings/ipma/history') {
		const csv = (name) => (q.get(name) ? q.get(name).split(',') : null)
		const area = csv('area')
		const type = csv('type')
		const kind = csv('kind')
		// from/to and occurredAt are Lisbon wall-clock ISO strings: compare as text.
		const from = q.get('from')
		const to = q.get('to')
		const body = fx.history.filter(
			(e) =>
				(!area || area.includes(e.area)) &&
				(!type || type.includes(e.type)) &&
				(!kind || kind.includes(e.kind)) &&
				(!from || e.occurredAt >= from) &&
				(!to || e.occurredAt <= to)
		)
		return { status: 200, body }
	}
	if (p === '/v2/weather/stations/ipma') return { status: 200, body: fx.stations }
	if (p === '/v2/weather/observations') return { status: 200, body: fx.observations }
	let m = p.match(/^\/v2\/weather\/stations\/(\d+)\/observations$/)
	if (m) return { status: 200, body: fx.stationSeries(m[1], Number(q.get('hours') ?? 48)) }
	m = p.match(/^\/v2\/weather\/stations\/(\d+)\/daily$/)
	if (m) return { status: 200, body: fx.stationDaily(m[1], Number(q.get('days') ?? 30)) }
	if (p === '/v2/incidents/active') return { status: 200, body: fx.incidents }
	if (p === '/v2/madeira/events/current') return { status: 200, body: { success: true, data: fx.madeiraEvent ?? null } }
	if (p === '/v2/madeira/occurrences') return { status: 200, body: { success: true, data: fx.madeiraOccurrences ?? [] } }
	return { status: 404, body: { error: 'not_found' } }
}
