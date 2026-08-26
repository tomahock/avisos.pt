// IPMA area-of-warning codes → district metadata.
// Continental Portugal (18 distritos) confirmed. Island codes not yet mapped.
// `lat`/`lng` are approximate centroids (district capital), used only to find
// the nearest weather station via haversine distance — precision doesn't matter.
// Order in this object is the render order in the overview grid (roughly N→S).

export const IPMA_AREAS = {
	VCT: { name: 'Viana do Castelo', lat: 41.6947, lng: -8.8322 },
	BGA: { name: 'Braga', lat: 41.5518, lng: -8.4229 },
	BGC: { name: 'Bragança', lat: 41.8071, lng: -6.7594 },
	PTO: { name: 'Porto', lat: 41.1579, lng: -8.6291 },
	VRL: { name: 'Vila Real', lat: 41.3006, lng: -7.744 },
	AVR: { name: 'Aveiro', lat: 40.6405, lng: -8.6538 },
	VIS: { name: 'Viseu', lat: 40.6566, lng: -7.9124 },
	GDA: { name: 'Guarda', lat: 40.5387, lng: -7.2683 },
	CBR: { name: 'Coimbra', lat: 40.2033, lng: -8.4103 },
	CBO: { name: 'Castelo Branco', lat: 39.8221, lng: -7.4919 },
	LRA: { name: 'Leiria', lat: 39.7466, lng: -8.8078 },
	SRE: { name: 'Santarém', lat: 39.2369, lng: -8.6857 },
	PTG: { name: 'Portalegre', lat: 39.2967, lng: -7.4281 },
	LSB: { name: 'Lisboa', lat: 38.7223, lng: -9.1393 },
	STB: { name: 'Setúbal', lat: 38.5244, lng: -8.8882 },
	EVR: { name: 'Évora', lat: 38.5714, lng: -7.9135 },
	BJA: { name: 'Beja', lat: 38.0155, lng: -7.8632 },
	FAR: { name: 'Faro', lat: 37.0194, lng: -7.9304 },
}

export const IPMA_AREA_CODES = Object.keys(IPMA_AREAS)

export function areaName(code) {
	return IPMA_AREAS[code]?.name ?? code
}

export function areaCentroid(code) {
	const a = IPMA_AREAS[code]
	if (!a) return null
	return { lat: a.lat, lng: a.lng }
}
