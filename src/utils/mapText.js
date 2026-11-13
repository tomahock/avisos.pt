// Texts of the /mapa maps. DOM/React-free.

/**
 * Empty text of the map popups for the selected period. The texts speak of
 * Portugal's warnings; a period with only Spanish ones (`pt` = 0, `es` > 0)
 * says so, so it doesn't read as "no warnings at all".
 * @param {{ isNow: boolean, pt: number, es: number }} counts warnings per country
 */
export function mapEmptyText({ isNow, pt, es }) {
	if (pt === 0 && es > 0) return isNow ? 'Sem avisos em vigor em Portugal.' : 'Sem avisos em Portugal neste período.'
	return isNow ? 'Sem avisos em vigor.' : 'Sem avisos neste período.'
}
