// IPMA area-of-warning codes → district/region metadata.
// Codes cross-checked against api.ipma.pt/open-data/forecast/warnings/warnings_www.json.
//
// - `name`: full name used in section headings and district-group titles.
// - `chip`: short label for the overview chip grid (name is fine if omitted).
// - `lat`/`lng`: approximate centroid, used only by haversine to pick the
//   nearest weather station — precision doesn't matter.
// - `region`: 'continental' | 'acores' | 'madeira' — drives which map + which
//   section of the overview grid the code lives in.

export const IPMA_AREAS = {
	// Continental (N→S)
	VCT: { name: 'Viana do Castelo', lat: 41.6947, lng: -8.8322, region: 'continental' },
	BRG: { name: 'Braga', lat: 41.5518, lng: -8.4229, region: 'continental' },
	BGC: { name: 'Bragança', lat: 41.8071, lng: -6.7594, region: 'continental' },
	PTO: { name: 'Porto', lat: 41.1579, lng: -8.6291, region: 'continental' },
	VRL: { name: 'Vila Real', lat: 41.3006, lng: -7.744, region: 'continental' },
	AVR: { name: 'Aveiro', lat: 40.6405, lng: -8.6538, region: 'continental' },
	VIS: { name: 'Viseu', lat: 40.6566, lng: -7.9124, region: 'continental' },
	GDA: { name: 'Guarda', lat: 40.5387, lng: -7.2683, region: 'continental' },
	CBR: { name: 'Coimbra', lat: 40.2033, lng: -8.4103, region: 'continental' },
	CBO: { name: 'Castelo Branco', lat: 39.8221, lng: -7.4919, region: 'continental' },
	LRA: { name: 'Leiria', lat: 39.7466, lng: -8.8078, region: 'continental' },
	STM: { name: 'Santarém', lat: 39.2369, lng: -8.6857, region: 'continental' },
	PTG: { name: 'Portalegre', lat: 39.2967, lng: -7.4281, region: 'continental' },
	LSB: { name: 'Lisboa', lat: 38.7223, lng: -9.1393, region: 'continental' },
	STB: { name: 'Setúbal', lat: 38.5244, lng: -8.8882, region: 'continental' },
	EVR: { name: 'Évora', lat: 38.5714, lng: -7.9135, region: 'continental' },
	BJA: { name: 'Beja', lat: 38.0155, lng: -7.8632, region: 'continental' },
	FAR: { name: 'Faro', lat: 37.0194, lng: -7.9304, region: 'continental' },

	// Açores
	AOC: { name: 'Açores – Grupo Ocidental', chip: 'Ocidental', lat: 39.4547, lng: -31.1272, region: 'acores' },
	ACE: { name: 'Açores – Grupo Central', chip: 'Central', lat: 38.6553, lng: -27.2205, region: 'acores' },
	AOR: { name: 'Açores – Grupo Oriental', chip: 'Oriental', lat: 37.7412, lng: -25.6756, region: 'acores' },

	// Madeira
	MCN: { name: 'Madeira – Costa Norte', chip: 'Costa Norte', lat: 32.7997, lng: -16.8834, region: 'madeira' },
	MCS: { name: 'Madeira – Costa Sul', chip: 'Costa Sul', lat: 32.6669, lng: -16.9241, region: 'madeira' },
	MRM: { name: 'Madeira – Regiões Montanhosas', chip: 'Montanha', lat: 32.758, lng: -16.941, region: 'madeira' },
	MPS: { name: 'Porto Santo', chip: 'Porto Santo', lat: 33.0619, lng: -16.3358, region: 'madeira' },
}

export const IPMA_AREA_CODES = Object.keys(IPMA_AREAS)

export const CONTINENTAL_CODES = IPMA_AREA_CODES.filter(
	(c) => IPMA_AREAS[c].region === 'continental'
)
export const ACORES_CODES = IPMA_AREA_CODES.filter(
	(c) => IPMA_AREAS[c].region === 'acores'
)
export const MADEIRA_CODES = IPMA_AREA_CODES.filter(
	(c) => IPMA_AREAS[c].region === 'madeira'
)

// Reverse lookup: continental district name (as it appears in the CAOP GeoJSON)
// → IPMA code. Only continental (islands need per-concelho resolution, see
// islandConcelhos.js).
export const IPMA_CODE_BY_CONTINENTAL_NAME = Object.fromEntries(
	CONTINENTAL_CODES.map((code) => [IPMA_AREAS[code].name, code])
)

export function areaName(code) {
	return IPMA_AREAS[code]?.name ?? code
}

export function areaChip(code) {
	const a = IPMA_AREAS[code]
	return a?.chip ?? a?.name ?? code
}

export function areaCentroid(code) {
	const a = IPMA_AREAS[code]
	if (!a) return null
	return { lat: a.lat, lng: a.lng }
}

export function codeFromContinentalName(disName) {
	return IPMA_CODE_BY_CONTINENTAL_NAME[disName] ?? null
}
