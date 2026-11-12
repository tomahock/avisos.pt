// awarenessTypeName from FogosPT → Font Awesome icon + short label.
// Icons are FA 6 (fas prefix — loaded via CDN in index.html); `svg`, when
// set, wins over `icon`. Render through <TypeIcon> / typeIconHtml() so both work.
// Add entries as new types appear; unknowns fall back to the generic exclamation.

// FA 6 Free has no wave glyph (fa-water is flat lines): "tsunami" from
// Material Symbols Rounded, filled (Apache-2.0, see NOTICE). viewBox cropped
// to the glyph so it fills the box like the FA icons do.
const WAVE_SVG = {
	viewBox: '80 -840 800 720',
	path: 'M481-157q-30 20-64.5 28.5T347-120q-35 0-69-9.5T213-157q-22 13-45.5 21.5T119-123q-16 2-27.5-9T80-160q0-17 11-29t28-16q19-5 35.5-13t32.5-19q11-8 25.5-8t25.5 8q24 17 52 26.5t57 9.5q29 0 57.5-9t52.5-26q11-8 25-7.5t25 8.5q24 17 51.5 25.5T615-201q30 0 58-10.5t53-27.5q11-7 23-7.5t23 7.5q16 11 32 20t35 14q17 5 29 16.5t12 28.5q0 17-12 28.5t-29 8.5q-24-4-46.5-13T749-157q-30 18-64.5 27.5T615-120q-35 0-69.5-9.5T481-157ZM80-300v-80q0-97 37.5-181T220-707q65-62 152.5-97.5T560-840q17 0 35.5.5T631-836q20 3 29.5 21t.5 36q-10 21-15.5 42t-5.5 44q0 55 39 94t94 39h67q17 0 28.5 11.5T880-520q0 17-11.5 28.5T840-480h-67q-89 0-151-62t-62-151q0-14 2-29.5t6-30.5q-74 18-121 76.5T400-540q0 36 11.5 68.5T444-410l13-9q11-8 23-8t23 8q23 16 53.5 27t58.5 11q28 0 58.5-11t53.5-27q11-7 22.5-7.5T772-420l22 15q11 6 22.5 11.5T840-385q17 5 28.5 16.5T880-340q0 17-12 28.5t-29 8.5q-23-4-45.5-12.5T749-337q-32 20-65 28.5t-69 8.5q-36 0-72-10t-62-27q-31 19-65 27.5t-69 9.5q-35 1-69-9t-65-28q-31 18-64.5 27.5T80-300Z',
}

const TYPE_META = {
	'Precipitação': { icon: 'fa-cloud-showers-heavy', label: 'Precipitação' },
	'Vento': { icon: 'fa-wind', label: 'Vento' },
	'Tempo Quente': { icon: 'fa-temperature-high', label: 'Tempo Quente' },
	'Tempo Frio': { icon: 'fa-temperature-low', label: 'Tempo Frio' },
	'Neve': { icon: 'fa-snowflake', label: 'Neve' },
	'Nevoeiro': { icon: 'fa-smog', label: 'Nevoeiro' },
	'Trovoada': { icon: 'fa-bolt', label: 'Trovoada' },
	'Agitação Marítima': { icon: 'fa-water', svg: WAVE_SVG, label: 'Agitação Marítima' },
	'Radiação UV': { icon: 'fa-sun', label: 'Radiação UV' },
}

export const WARNING_TYPE_NAMES = Object.keys(TYPE_META)

const FALLBACK = { icon: 'fa-triangle-exclamation', label: null }

export function warningTypeMeta(name) {
	return TYPE_META[name] ?? { ...FALLBACK, label: name }
}

// Display order for warning types — same as IPMA's own legend, so people
// coming from there feel at home. Unknown types sort last.
const TYPE_ORDER = [
	'Trovoada',
	'Agitação Marítima',
	'Precipitação',
	'Vento',
	'Neve',
	'Tempo Frio',
	'Tempo Quente',
	'Nevoeiro',
]

// Icon markup for HTML strings (Leaflet divIcons): the inline SVG, sized and
// coloured like a FA glyph (1em tall, currentColor), or the FA <i>.
export function typeIconHtml(name) {
	const meta = warningTypeMeta(name)
	if (meta.svg) {
		const [, , w, h] = meta.svg.viewBox.split(' ').map(Number)
		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${meta.svg.viewBox}" width="${(w / h).toFixed(3)}em" height="1em" fill="currentColor" aria-hidden="true"><path d="${meta.svg.path}"/></svg>`
	}
	return `<i class="fas ${meta.icon}"></i>`
}

export function typeRank(name) {
	const i = TYPE_ORDER.indexOf(name)
	return i === -1 ? TYPE_ORDER.length : i
}
