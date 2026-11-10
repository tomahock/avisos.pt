// ANEPC incidents (via the FogosPT API) shown on district pages.
// Shared by browser and functions — keep it DOM/React-free.

import { CONTINENTAL_CODES, IPMA_AREAS } from '../data/ipmaAreas.js'

function norm(s) {
	return String(s ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim()
}

// ANEPC district names don't always match ours letter for letter
// ("Viana Do Castelo") — compare without case/accents. Continental only:
// ANEPC doesn't cover the Azores/Madeira.
const CODE_BY_NAME = Object.fromEntries(CONTINENTAL_CODES.map((c) => [norm(IPMA_AREAS[c].name), c]))

export function incidentDistrictCode(name) {
	return CODE_BY_NAME[norm(name)] ?? null
}

export function incidentUrl(id) {
	return `https://fogos.pt/pt/fogo/${encodeURIComponent(id)}/detalhe`
}

// natureza (ANEPC text) → FA 6.0-beta2 icon + short label for the summary.
// Matched by keyword because ANEPC's wording is stable but codes are opaque.
const KINDS = [
	{ match: /inunda|alagament/, icon: 'fa-water', label: 'Inundações' },
	{ match: /arvore/, icon: 'fa-tree', label: 'Quedas de árvores' },
	{ match: /limpeza de via|sinalizacao/, icon: 'fa-road', label: 'Limpeza de vias' },
	{ match: /electric|eletric|energia/, icon: 'fa-bolt', label: 'Redes elétricas' },
	{ match: /telecomunica|comunicac/, icon: 'fa-tower-broadcast', label: 'Telecomunicações' },
	{ match: /movimento de massa|derrocada|desliza/, icon: 'fa-mountain', label: 'Movimentos de massa' },
	{ match: /estrutura|edificio|queda de/, icon: 'fa-house-crack', label: 'Estruturas' },
	{ match: /corte ou remocao|perigo de queda/, icon: 'fa-helmet-safety', label: 'Elementos em perigo de queda' },
]
const OTHER = { icon: 'fa-triangle-exclamation', label: 'Outras ocorrências' }

export function incidentKind(natureza) {
	const n = norm(natureza)
	// "perigo de queda" before the generic "queda de" (structures).
	if (/corte ou remocao|perigo de queda/.test(n)) return KINDS.at(-1)
	return KINDS.find((k) => k.match.test(n)) ?? OTHER
}

export function districtIncidents(list, code) {
	return (list ?? []).filter((i) => incidentDistrictCode(i.district) === code)
}
