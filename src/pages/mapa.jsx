import { useCallback, useEffect, useState } from 'react'

import Layout from '../layouts/index.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import WarningsMap from '../components/map/WarningsMap.jsx'
import { fetchJson } from '../utils/fetchJson.js'
import { usePageTitle } from '../utils/pageTitle.js'

async function fetchGeoJson(signal) {
	const [cont, isl] = await Promise.all([
		fetchJson('/data/pt-continental.geojson', signal),
		fetchJson('/data/pt-arquipelagos.geojson', signal),
	])
	return {
		type: 'FeatureCollection',
		features: [...cont.features, ...isl.features],
	}
}

export default function MapPage() {
	usePageTitle('Mapa · Avisos.pt')

	const [warnings, setWarnings] = useState(null)
	const [stations, setStations] = useState([])
	const [obs, setObs] = useState({})
	const [geojson, setGeojson] = useState(null)
	const [error, setError] = useState(null)
	const [updatedAt, setUpdatedAt] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
		const ctrl = new AbortController()

		Promise.all([
			fetchJson('/api/warnings', ctrl.signal),
			fetchGeoJson(ctrl.signal),
		])
			.then(([w, g]) => {
				setWarnings(w)
				setGeojson(g)
				setUpdatedAt(new Date())
			})
			.catch((err) => {
				if (err.name !== 'AbortError') setError(err.message)
			})

		fetchJson('/api/stations', ctrl.signal)
			.then(setStations)
			.catch(() => {})

		fetchJson('/api/observations', ctrl.signal)
			.then((data) => setObs(data?.stations ?? {}))
			.catch(() => {})

		return () => ctrl.abort()
	}, [reloadKey])

	const retry = useCallback(() => {
		setError(null)
		setWarnings(null)
		setGeojson(null)
		setReloadKey((k) => k + 1)
	}, [])

	if (error) {
		return (
			<Layout>
				<StateError message={error} onRetry={retry} />
			</Layout>
		)
	}

	if (warnings === null || geojson === null) {
		return (
			<Layout>
				<StateLoading />
			</Layout>
		)
	}

	return (
		<Layout updatedAt={updatedAt}>
			<WarningsMap
				geojson={geojson}
				warnings={warnings}
				stations={stations}
				observations={obs}
			/>
		</Layout>
	)
}
