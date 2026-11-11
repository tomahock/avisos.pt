// FogosPT-shaped test data, generated relative to `now` so warnings are always
// current. Shared by the component tests (tests/helpers/api.js) and the E2E
// mock server (tests/mock-fogos/server.mjs). Plain JS, no dependencies.

import { lisbonIso } from '../../src/utils/history.js'

const HOUR = 3600 * 1000

// Station catalog subset (real IPMA ids/names) + edge cases.
export const STATIONS = [
	{ id: 1200535, name: 'Lisboa (Geofísico)', lng: -9.14972222, lat: 38.71907778 },
	{ id: 1200545, name: 'Porto, Pedras Rubras (Aeródromo)', lng: -8.681332, lat: 41.233502 },
	{ id: 1200541, name: 'Sines', lng: -8.838271, lat: 37.954504 },
	{ id: 1200576, name: 'Bragança (Aeródromo)', lng: -6.70796389, lat: 41.85763611 },
	{ id: 1200843, name: 'Évora (Aeródromo)', lng: -7.8916, lat: 38.5296 }, // every reading -99
	{ id: 9900001, name: 'Funchal (Teste)', lng: -16.9, lat: 32.65 },
	{ id: 9900002, name: 'Ponta Delgada (Teste)', lng: -25.67, lat: 37.74 },
]
export const STATION_ID = 1200535
export const BROKEN_STATION_ID = 1200843

// "2026-11-11T13:00" — FogosPT observation hour keys are UTC.
const utcHour = (t) => new Date(Math.floor(t / HOUR) * HOUR).toISOString().slice(0, 16)

function reading(id, t) {
	if (id === BROKEN_STATION_ID) {
		return { temperatura: -99, humidade: -99, pressao: -99, precAcumulada: -99, intensidadeVento: -99, intensidadeVentoKM: -99, idDireccVento: -99, radiacao: -99 }
	}
	const h = new Date(t).getUTCHours()
	const seed = id % 7
	return {
		temperatura: Math.round((12 + seed + 4 * Math.sin((h / 24) * 2 * Math.PI)) * 10) / 10,
		humidade: 70 + seed,
		pressao: 1010 + seed,
		precAcumulada: h % 3 === 0 ? 0.4 * (seed + 1) : 0,
		intensidadeVento: 5 + seed,
		intensidadeVentoKM: 18 + 3 * seed,
		idDireccVento: (seed % 8) + 1,
		radiacao: 100,
	}
}

export function makeFixtures(now = new Date()) {
	const t = now.getTime()
	const at = (hours) => lisbonIso(t + hours * HOUR)

	const w = (idAreaAviso, awarenessTypeName, awarenessLevelID, from, to, text = 'Texto do aviso de teste.') => ({
		text,
		awarenessTypeName,
		idAreaAviso,
		awarenessLevelID,
		startTime: at(from),
		endTime: at(to),
	})
	const warnings = [
		w('LSB', 'Vento', 'orange', -2, 10, 'Rajadas até 90 km/h.'),
		w('LSB', 'Precipitação', 'yellow', 2, 20, 'Chuva por vezes forte.'),
		w('PTO', 'Precipitação', 'red', -1, 6, 'Chuva muito forte e persistente.'),
		w('FAR', 'Agitação Marítima', 'yellow', -3, 30, 'Ondas de sudoeste com 4 a 5 metros.'),
		w('MCS', 'Vento', 'orange', 1, 12, 'Rajadas até 100 km/h nas zonas montanhosas.'),
		w('AOR', 'Trovoada', 'yellow', 4, 14),
		w('MRM', 'Vento', 'yellow', -1, 8),
	]

	const stations = STATIONS.map((s) => ({
		type: 'Feature',
		properties: { idEstacao: s.id, localEstacao: s.name },
		geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
	}))
	// A catalog entry without geometry must be tolerated everywhere.
	stations.push({ type: 'Feature', properties: { idEstacao: 9900003, localEstacao: 'Sem coordenadas' }, geometry: null })

	// /v2/weather/observations: 24 hourly snapshots of every station.
	const observations = {}
	for (let i = 23; i >= 0; i--) {
		const ts = t - i * HOUR
		const row = {}
		for (const s of STATIONS) {
			// Sines misses one hour — holes must not break charts.
			if (s.id === 1200541 && i === 5) continue
			row[s.id] = reading(s.id, ts)
		}
		observations[utcHour(ts)] = row
	}

	const stationSeries = (id, hours) => ({
		stationId: id,
		observations: Array.from({ length: hours }, (_, i) => {
			const ts = t - (hours - 1 - i) * HOUR
			return { date: utcHour(ts), ...reading(Number(id), ts) }
		}).filter((_, i) => i % 11 !== 5), // a few missing hours
	})

	const stationDaily = (id, days) => ({
		stationId: Number(id),
		daily: Array.from({ length: days }, (_, i) => {
			const d = new Date(t - (days + 1 - i) * 24 * HOUR).toISOString().slice(0, 10)
			return i === 3
				? { date: d, temp_min: null, temp_max: null, prec_quant: null, hum_med: null }
				: { date: d, temp_min: 9 + (i % 4), temp_max: 17 + (i % 5), prec_quant: i % 3 ? 0 : 3.2, hum_med: 80 }
		}),
	})

	const ev = (kind, area, type, fromLevel, toLevel, hoursAgo, extra = {}) => ({
		id: `${kind}-${area}-${hoursAgo}`,
		kind,
		area,
		type,
		fromLevel,
		toLevel,
		startTime: at(-hoursAgo - 1),
		endTime: at(-hoursAgo + 9),
		previousEndTime: null,
		text: 'Texto.',
		previousText: null,
		reportDate: at(-hoursAgo),
		occurredAt: at(-hoursAgo),
		...extra,
	})
	const history = [
		ev('agravado', 'LSB', 'Vento', 'yellow', 'orange', 2),
		ev('desagravado', 'PTO', 'Precipitação', 'red', 'orange', 3),
		ev('emitido', 'LSB', 'Vento', null, 'yellow', 8),
		ev('prolongado', 'FAR', 'Agitação Marítima', 'yellow', 'yellow', 26, { previousEndTime: at(-20) }),
		ev('retirado', 'MCN', 'Vento', 'orange', null, 27),
		ev('terminado', 'BGC', 'Neve', 'yellow', null, 30),
	]

	const incidents = {
		data: [
			{
				id: 2026001,
				dateTime: { sec: Math.floor((t - 40 * 60000) / 1000) },
				natureza: 'Queda de árvore',
				naturezaCode: '3101',
				status: 'Em curso',
				statusCode: 5,
				statusColor: 'B81E1F',
				district: 'Lisboa',
				concelho: 'Sintra',
				freguesia: 'Colares',
				localidade: 'Azenhas do Mar',
				lat: 38.84,
				lng: -9.46,
				man: 6,
				terrain: 2,
				aerial: 0,
				meios_aquaticos: 0,
			},
			{
				id: 2026002,
				dateTime: { sec: Math.floor((t - 90 * 60000) / 1000) },
				natureza: 'Inundação de estruturas ou superfícies por precipitação intensa',
				status: 'Em resolução',
				district: 'Porto',
				concelho: 'Maia',
				lat: 41.23,
				lng: -8.62,
				man: 4,
				terrain: 1,
			},
		],
	}

	return { now, warnings, stations, observations, stationSeries, stationDaily, history, incidents }
}
