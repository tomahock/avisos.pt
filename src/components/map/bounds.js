// Bounds checks for the region maps. Catalog entries without usable
// coordinates are dropped — one bad entry must never take the whole map down.

export function pointInBounds(lng, lat, bounds) {
	if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false
	if (!bounds) return true
	return lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax
}

// Station = GeoJSON feature, coordinates [lng, lat].
export function stationInBounds(feature, bounds) {
	const [lng, lat] = feature?.geometry?.coordinates ?? []
	return pointInBounds(lng, lat, bounds)
}
