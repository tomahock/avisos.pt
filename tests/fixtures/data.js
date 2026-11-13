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
	{ id: 9900002, name: 'Ponta Delgada (Teste)', lng: -25.67, lat: 37.74 }, // strong mean wind (Açores criterion)
	{ id: 9900010, name: 'Lisboa, Chuva Forte (Teste)', lng: -9.16, lat: 38.76 }, // heavy rain
	{ id: 9900011, name: 'Beja, Calor (Teste)', lng: -7.87, lat: 38.02 }, // near Tempo Quente
]
export const STATION_ID = 1200535
export const BROKEN_STATION_ID = 1200843
// Readings near IPMA warning thresholds (src/utils/criteriaThresholds.js):
// rain 11 mm in the latest hour (≥ yellow 10 mm/h), 7 mm/h for the 6 h
// before (6 h sum 46 mm ≥ orange 41 mm/6h); Açores mean wind 58–68 km/h
// (latest 68 ≥ yellow 65); Beja max ~36 °C (yellow Tempo Quente 37).
export const RAIN_STATION_ID = 9900010
export const WIND_STATION_ID = 9900002
export const HOT_STATION_ID = 9900011

// "2026-11-11T13:00" — FogosPT observation hour keys are UTC.
const utcHour = (t) => new Date(Math.floor(t / HOUR) * HOUR).toISOString().slice(0, 16)

function reading(id, t, now) {
	const ago = Math.round((now - t) / HOUR)
	if (id === RAIN_STATION_ID) {
		return { ...reading(STATION_ID, t, now), precAcumulada: ago === 0 ? 11 : ago <= 6 ? 7 : 0 }
	}
	if (id === WIND_STATION_ID) {
		return { ...reading(1200541, t, now), intensidadeVentoKM: ago === 0 ? 68 : 58 + (ago % 5) * 2, intensidadeVento: 18 }
	}
	if (id === HOT_STATION_ID) {
		const h = new Date(t).getUTCHours()
		return { ...reading(1200843 + 1, t, now), temperatura: Math.round((33 + 3 * Math.sin((h / 24) * 2 * Math.PI)) * 10) / 10 }
	}
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
		// Starts in 5 h: no sea band for Porto Santo "Agora", one on a day tab.
		w('MPS', 'Agitação Marítima', 'orange', 5, 15, 'Ondas de noroeste com 3 a 4 metros.'),
	]

	// AEMET (Spain) via FogosPT /v2/warnings/aemet?peninsula=1: the IPMA
	// shape (awarenessTypeName already in Portuguese) + AEMET's own fields.
	const aw = (idAreaAviso, areaName, type, level, from, to, phenomenon, parameter, probability = '40%-70%') => ({
		...w(idAreaAviso, type, level, from, to, `${parameter.trim()}.`),
		areaName,
		phenomenon,
		parameter,
		probability,
	})
	const aemetWarnings = [
		aw('674901', 'Sanabria', 'Vento', 'orange', -1, 10, 'VI', 'Rachas máximas: 90 km/h', '40%-70%'),
		aw('713603C', 'Costa - Miño de Pontevedra', 'Agitação Marítima', 'yellow', -2, 20, 'CO', 'Costeros: '),
		// Starts after the last PT endTime (FAR, +30 h): its day tab exists only because of Spain.
		aw('713202', 'Miño de Ourense', 'Precipitação', 'yellow', 54, 60, 'PR', 'Precipitación acumulada en 12 horas: 40 mm'),
		aw('612103', 'Litoral de Huelva', 'Polvo en suspensión', 'yellow', -1, 8, 'VS', 'Visibilidad mínima: 3000 m'),
		// Already ended: the proxy must drop it.
		aw('701001', 'Norte de Cáceres', 'Precipitação', 'yellow', -30, -1, 'PR', 'Precipitación acumulada en 12 horas: 40 mm'),
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
			row[s.id] = reading(s.id, ts, t)
		}
		observations[utcHour(ts)] = row
	}

	const stationSeries = (id, hours) => ({
		stationId: id,
		observations: Array.from({ length: hours }, (_, i) => {
			const ts = t - (hours - 1 - i) * HOUR
			return { date: utcHour(ts), ...reading(Number(id), ts, t) }
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

	// SRPC, IP-RAM (Madeira) via FogosPT: real UTC instants ("…Z"), unlike
	// the IPMA warnings. One occurrence per Madeira area + odd ones: copies,
	// no concelho, no coordinates (before FogosPT/fogosapi#101).
	const utc = (minutes) => new Date(t + minutes * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z')
	const occ = (id, minutesAgo, natureCode, nature, parishCode, parish, municipalityCode, municipality, lat, lng, extra = {}) => ({
		id,
		copies: 1,
		start: utc(-minutesAgo),
		natureCode,
		nature,
		firefighters: 2,
		vehicles: 1,
		parishCode,
		parish,
		municipalityCode,
		municipality,
		...(lat === undefined ? {} : { lat, lng, location: lat === null ? null : 'parish' }),
		entities: ['CMOS'],
		updatedAt: utc(-minutesAgo + 3),
		...extra,
	})
	const madeiraOccurrences = [
		occ('occ-funchal-1', 20, '3301', 'Queda de Árvore', '310307', 'São Martinho', '3103', 'Funchal', 32.6443, -16.9381),
		occ('occ-funchal-2', 50, '3315', 'Inundação de estruturas ou superfícies por precipitação intensa', '310307', 'São Martinho', '3103', 'Funchal', 32.6443, -16.9381, { copies: 2, firefighters: 4 }),
		occ('occ-sem-concelho', 10, '3313', 'Movimento de massa', null, null, null, null, null, null, { firefighters: 0, vehicles: 0, entities: [] }),
		occ('occ-canico', 180, '3313', 'Movimento de massa', '310803', 'Caniço', '3108', 'Santa Cruz', 32.6497, -16.8523),
		occ('occ-santana', 120, '3313', 'Movimento de massa', '310904', 'Santana', '3109', 'Santana', 32.8036, -16.8817),
		occ('occ-porto-santo', 300, '4305', 'Limpeza de Via e Sinalização de Perigo', '320101', 'Porto Santo', '3201', 'Porto Santo', 33.0703, -16.3398),
		occ('occ-machico-sem-coords', 360, '3311', 'Queda de elementos de construção em estruturas edificadas', '310403', 'Machico', '3104', 'Machico', undefined),
	]
	const madeiraEvent = {
		id: 'evento-teste',
		title: 'Depressão Teste – Precipitação e vento forte',
		zone: 'Madeira e Porto Santo',
		status: 'ATIVO',
		active: true,
		start: utc(-16 * 60),
		end: utc(-5),
		untilNow: true,
		updatedAt: utc(-5),
		kpi: { occurrences: 48, activeOccurrences: 7, operationals: 120, groundAssets: 50, municipalities: 4, peak: { time: utc(-6 * 60), occurrences: 9 } },
		summary: 'Desde ontem registaram-se 48 ocorrências na Região, com maior incidência no Funchal.',
		recommendations: ['Evite deslocações desnecessárias.', 'Mantenha-se afastado de ribeiras, taludes e encostas.'],
		municipalities: [
			{ name: 'Funchal', occurrences: 30, operationals: 70, groundAssets: 30, natures: [] },
			{ name: 'Santana', occurrences: 10, operationals: 20, groundAssets: 10, natures: [] },
			{ name: 'Porto Santo', occurrences: 3, operationals: 6, groundAssets: 3, natures: [] },
			{ name: 'Sem concelho', occurrences: 5, operationals: 0, groundAssets: 0, natures: [] },
		],
		natures: [{ code: '3313', description: 'Movimento de massa', occurrences: 20, percentage: 41.7 }],
		hourly: [{ time: utc(-60), occurrences: 3, cumulative: 48 }],
		roadRestrictions: [
			{ road: 'ER 101', closed: true, text: 'Cortada ao km 12 devido a derrocada', time: utc(-90) },
			{ road: 'VR 1', closed: false, text: 'Condicionada a uma via no túnel da Ribeira Brava', time: null },
		],
		communiques: [
			{ title: 'Aviso à população 18/2026 – Depressão Teste', time: utc(-20 * 60), text: 'Texto longo do comunicado…', link: 'https://www.procivmadeira.pt/pt/10-noticias/aviso-18-2026.html', official: true },
			{ title: 'Comunicado sem ligação', time: utc(-3 * 24 * 60), text: null, link: null, official: true },
		],
		parishes: [{ code: '310307', name: 'São Martinho', municipality: 'Funchal', lat: 32.6443, lng: -16.9381, location: 'parish', occurrences: 12, firefighters: 30, vehicles: 12 }],
		entities: [{ code: 'CMOS', occurrences: 20 }],
		topOccurrences: madeiraOccurrences.slice(0, 2),
		notes: 'Dados provisórios, sujeitos a validação.',
		source: 'SRPC-RAM (Preventech) · IPMA · ECMWF',
	}

	return { now, warnings, aemetWarnings, stations, observations, stationSeries, stationDaily, history, incidents, madeiraEvent, madeiraOccurrences }
}
