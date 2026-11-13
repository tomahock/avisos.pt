import { useEffect, useState } from 'react'

import { fetchJson } from '../utils/fetchJson.js'
import { zonesMetaFrom } from '../utils/spain.js'

// Metadata of the AEMET zones (public/data/es-zones.geojson), fetched once:
// Map code → { name, province, ccaa }. Null while loading or on failure.
export function useSpainZones() {
	const [meta, setMeta] = useState(null)

	useEffect(() => {
		const ctrl = new AbortController()
		fetchJson('/data/es-zones.geojson', ctrl.signal)
			.then((fc) => setMeta(zonesMetaFrom(fc)))
			.catch(() => {})
		return () => ctrl.abort()
	}, [])

	return meta
}
