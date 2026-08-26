// awarenessTypeName from FogosPT → Font Awesome icon + short label.
// Icons are FA 6 (fas prefix — loaded via CDN in index.html).
// Add entries as new types appear; unknowns fall back to the generic exclamation.

const TYPE_META = {
	'Precipitação': { icon: 'fa-cloud-showers-heavy', label: 'Precipitação' },
	'Vento': { icon: 'fa-wind', label: 'Vento' },
	'Tempo Quente': { icon: 'fa-temperature-high', label: 'Tempo Quente' },
	'Tempo Frio': { icon: 'fa-temperature-low', label: 'Tempo Frio' },
	'Neve': { icon: 'fa-snowflake', label: 'Neve' },
	'Nevoeiro': { icon: 'fa-smog', label: 'Nevoeiro' },
	'Trovoada': { icon: 'fa-bolt', label: 'Trovoada' },
	'Agitação Marítima': { icon: 'fa-water', label: 'Agitação Marítima' },
	'Radiação UV': { icon: 'fa-sun', label: 'Radiação UV' },
}

const FALLBACK = { icon: 'fa-triangle-exclamation', label: null }

export function warningTypeMeta(name) {
	return TYPE_META[name] ?? { ...FALLBACK, label: name }
}
