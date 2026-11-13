// AEMET (Spain) warning texts. Import-free on purpose: WarningCard (main
// chunk) uses it, and utils/spain.js would pull the border-zone tables in.

// AEMET's parameter ("Rachas máximas: 90 km/h"). Coastal warnings carry no
// value ("Costeros: ") — a parameter ending in ":" is treated as absent.
export function parameterText(w) {
	const p = typeof w?.parameter === 'string' ? w.parameter.trim() : ''
	return !p || p.endsWith(':') ? null : p
}

// AEMET's probability band, "40%-70%" → "40–70 %".
export function probabilityText(w) {
	const p = typeof w?.probability === 'string' ? w.probability.trim() : ''
	if (!p) return null
	const m = p.match(/^(\d+)\s*%?\s*-\s*(\d+)\s*%$/)
	return m ? `${m[1]}–${m[2]} %` : p
}

// AEMET's text without the threshold it starts with (land warnings read
// "Rachas máximas: 80 km/h. Viento del suroeste.", the threshold being
// shown apart as «Limiar»); null when nothing is left. Unchanged when there
// is no threshold or the text doesn't start with it.
export function displayText(w) {
	const text = typeof w?.text === 'string' ? w.text.trim() : ''
	if (!text) return null
	const p = parameterText(w)
	if (!p || !text.startsWith(p)) return text
	const rest = text.slice(p.length).replace(/^\s*\.?\s*/, '').trim()
	return rest || null
}
