import { useCallback, useEffect, useMemo, useState } from 'react'

import Layout from '../layouts/index.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import WarningsMap from '../components/map/WarningsMap.jsx'
import { fetchJson } from '../utils/fetchJson.js'
import { usePageTitle } from '../utils/pageTitle.js'

const REGIONS = [
	{
		key: 'continental',
		title: 'Portugal Continental',
		center: [39.6, -8.2],
		zoom: 7,
		bounds: { latMin: 36.9, latMax: 42.2, lngMin: -9.6, lngMax: -6.2 },
		heightClass: 'h-[65vh] min-h-[500px]',
	},
	{
		key: 'acores',
		title: 'Açores',
		disName: 'Açores',
		center: [38.6, -28],
		zoom: 7,
		bounds: { latMin: 36.9, latMax: 40, lngMin: -31.5, lngMax: -25 },
		heightClass: 'h-[420px]',
	},
	{
		key: 'madeira',
		title: 'Madeira',
		disName: 'Madeira',
		center: [32.85, -16.7],
		zoom: 9,
		bounds: { latMin: 32.3, latMax: 33.2, lngMin: -17.3, lngMax: -16.2 },
		heightClass: 'h-[420px]',
	},
]

function subCollection(features) {
	return { type: 'FeatureCollection', features }
}

export default function MapPage() {
	usePageTitle('Mapa · Avisos.pt')

	const [warnings, setWarnings] = useState(null)
	const [stations, setStations] = useState([])
	const [obs, setObs] = useState({})
	const [geoContinental, setGeoContinental] = useState(null)
	const [geoArquipelagos, setGeoArquipelagos] = useState(null)
	const [error, setError] = useState(null)
	const [updatedAt, setUpdatedAt] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
		const ctrl = new AbortController()

		Promise.all([
			fetchJson('/api/warnings', ctrl.signal),
			fetchJson('/data/pt-continental.geojson', ctrl.signal),
			fetchJson('/data/pt-arquipelagos.geojson', ctrl.signal),
		])
			.then(([w, c, a]) => {
				setWarnings(w)
				setGeoContinental(c)
				setGeoArquipelagos(a)
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
		setGeoContinental(null)
		setGeoArquipelagos(null)
		setReloadKey((k) => k + 1)
	}, [])

	const regionData = useMemo(() => {
		if (!geoContinental || !geoArquipelagos) return null
		return {
			continental: geoContinental,
			acores: subCollection(
				geoArquipelagos.features.filter((f) => f.properties.dis_name === 'Açores')
			),
			madeira: subCollection(
				geoArquipelagos.features.filter((f) => f.properties.dis_name === 'Madeira')
			),
		}
	}, [geoContinental, geoArquipelagos])

	if (error) {
		return (
			<Layout>
				<StateError message={error} onRetry={retry} />
			</Layout>
		)
	}

	if (warnings === null || regionData === null) {
		return (
			<Layout>
				<StateLoading />
			</Layout>
		)
	}

	const [continental, acores, madeira] = REGIONS

	return (
		<Layout updatedAt={updatedAt}>
			<div className="px-4 mt-4">
				<RegionCard region={continental}>
					<WarningsMap
						geojson={regionData.continental}
						warnings={warnings}
						stations={stations}
						observations={obs}
						center={continental.center}
						zoom={continental.zoom}
						bounds={continental.bounds}
						height={continental.heightClass}
						showLegend
					/>
				</RegionCard>
			</div>

			<div className="mt-4 px-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
				<RegionCard region={acores}>
					<WarningsMap
						geojson={regionData.acores}
						warnings={warnings}
						stations={stations}
						observations={obs}
						center={acores.center}
						zoom={acores.zoom}
						bounds={acores.bounds}
						height={acores.heightClass}
					/>
				</RegionCard>
				<RegionCard region={madeira}>
					<WarningsMap
						geojson={regionData.madeira}
						warnings={warnings}
						stations={stations}
						observations={obs}
						center={madeira.center}
						zoom={madeira.zoom}
						bounds={madeira.bounds}
						height={madeira.heightClass}
					/>
				</RegionCard>
			</div>
		</Layout>
	)
}

function RegionCard({ region, children }) {
	return (
		<section>
			<h2 className="text-lg font-bold text-gray-900 mb-2 px-1">{region.title}</h2>
			<div className="rounded-md overflow-hidden border border-gray-200">
				{children}
			</div>
		</section>
	)
}
