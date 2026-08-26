const EARTH_KM = 6371

function toRad(deg) {
	return (deg * Math.PI) / 180
}

// Great-circle distance in km between two {lat,lng} points.
export function haversineKm(a, b) {
	const dLat = toRad(b.lat - a.lat)
	const dLng = toRad(b.lng - a.lng)
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
	return 2 * EARTH_KM * Math.asin(Math.sqrt(s))
}

// Given a centroid and a station catalog (GeoJSON Features), returns the
// closest station that also has current observations. Falls back to null.
export function nearestStationWithObs(centroid, stations, observationsByStation) {
	if (!centroid) return null
	let best = null
	let bestDist = Infinity
	for (const feature of stations) {
		const props = feature?.properties
		const coords = feature?.geometry?.coordinates
		if (!props || !coords) continue
		const id = String(props.idEstacao)
		if (!observationsByStation[id]) continue
		const point = { lng: coords[0], lat: coords[1] }
		const d = haversineKm(centroid, point)
		if (d < bestDist) {
			bestDist = d
			best = {
				id,
				name: props.localEstacao,
				distanceKm: d,
				obs: observationsByStation[id],
			}
		}
	}
	return best
}
