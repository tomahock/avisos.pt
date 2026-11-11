import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayerGroup, LayersControl } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import MapPeriodPicker from '../components/map/MapPeriodPicker.jsx'
import MadeiraOccurrencesLayer from '../components/map/MadeiraOccurrencesLayer.jsx'
import WarningsMap from '../components/map/WarningsMap.jsx'
import { fetchJson } from '../utils/fetchJson.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { PAGE_META } from '../utils/share.js'
import { mapPeriods, warningsInPeriod } from '../utils/timeline.js'
import { occurrenceWindow, occurrencesBetween, parishGroups, srpcFresh, totalCount } from '../utils/madeira.js'
import { useActiveWarnings } from '../hooks/useActiveWarnings.js'
import { useMadeiraSrpc } from '../hooks/useMadeiraSrpc.js'

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

// No visible title (the map is the page); search engines and screen
// readers still need one h1.
function PageHeading() {
	return <h1 className="sr-only">{PAGE_META['/mapa'].title}</h1>
}

export default function MapPage() {
	usePageTitle(`${PAGE_META['/mapa'].title} · Avisos.pt`, {
		description: PAGE_META['/mapa'].description,
	})

	const [rawWarnings, setWarnings] = useState(null)
	const warnings = useActiveWarnings(rawWarnings)
	const [stations, setStations] = useState([])
	const [obs, setObs] = useState({})
	const [geoContinental, setGeoContinental] = useState(null)
	const [geoArquipelagos, setGeoArquipelagos] = useState(null)
	const [error, setError] = useState(null)
	const [updatedAt, setUpdatedAt] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)
	const [now, setNow] = useState(() => new Date())
	const [searchParams, setSearchParams] = useSearchParams()

	// SRPC, IP-RAM occurrences (Madeira) — optional layer, never blocks the
	// page; polled on its own every 2 min like the district pages.
	const srpc = useMadeiraSrpc({ event: false })
	const occLoadedAt = srpc.loadedAt.occurrences
	const occFailed = srpc.failed.occurrences

	// Keep "Agora" honest on a page left open — warnings start/end over time.
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 60 * 1000)
		return () => clearInterval(id)
	}, [])

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

	const periods = useMemo(() => mapPeriods(warnings ?? [], now), [warnings, now])
	// Unknown / stale ?dia= (e.g. a shared link from yesterday) falls back to "Agora".
	const period = periods.find((p) => p.key === searchParams.get('dia')) ?? periods[0]
	const selectPeriod = useCallback(
		(key) => setSearchParams(key === 'agora' ? {} : { dia: key }, { replace: true }),
		[setSearchParams]
	)
	const periodWarnings = useMemo(
		() => (warnings ? warningsInPeriod(warnings, period) : []),
		[warnings, period]
	)
	const isNow = period.key === 'agora'
	// Occurrences are past events: "Agora" = last 24 h, today = since
	// midnight, future days = none (the layer stays, empty, with a note).
	// A snapshot that stopped refreshing for 15 min is dropped, not shown
	// against a window that keeps moving.
	const occFresh = srpcFresh(occLoadedAt, occFailed, now.getTime())
	const occurrences = useMemo(() => (occFresh ? srpc.occurrences : occLoadedAt ? [] : null), [occFresh, srpc.occurrences, occLoadedAt])
	const occWindow = useMemo(() => occurrenceWindow(period, now), [period, now])
	const periodOccurrences = useMemo(
		() => (occurrences && occWindow ? occurrencesBetween(occurrences, occWindow.from, occWindow.to) : []),
		[occurrences, occWindow]
	)
	const emptyText = isNow ? 'Sem avisos em vigor.' : 'Sem avisos neste período.'

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
				<PageHeading />
				<StateError message={error} onRetry={retry} />
			</Layout>
		)
	}

	if (warnings === null || regionData === null) {
		return (
			<Layout>
				<PageHeading />
				<StateLoading />
			</Layout>
		)
	}

	const [continental, acores, madeira] = REGIONS

	return (
		<Layout updatedAt={updatedAt}>
			<PageHeading />
			<div className="px-4 mt-4 space-y-2">
				<MapPeriodPicker
					periods={periods}
					warnings={warnings}
					selected={period.key}
					onSelect={selectPeriod}
				/>
				<p className="text-xs text-gray-500 px-1">
					{isNow
						? 'Avisos em vigor neste momento.'
						: `Avisos previstos para ${period.main.toLowerCase()}${period.sub ? ` (${period.sub})` : ''} — pior nível de cada região ao longo do dia.`}
				</p>
			</div>

			<div className="px-4 mt-4">
				<RegionCard region={continental}>
					<WarningsMap
						geojson={regionData.continental}
						warnings={periodWarnings}
						emptyText={emptyText}
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
						warnings={periodWarnings}
						emptyText={emptyText}
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
						warnings={periodWarnings}
						emptyText={emptyText}
						stations={stations}
						observations={obs}
						center={madeira.center}
						zoom={madeira.zoom}
						bounds={madeira.bounds}
						height={madeira.heightClass}
						overlays={
							occurrences && (
								<LayersControl.Overlay checked name="Ocorrências SRPC-RAM">
									<LayerGroup>
										<MadeiraOccurrencesLayer occurrences={periodOccurrences} windowLabel={occWindow?.label ?? ''} />
									</LayerGroup>
								</LayersControl.Overlay>
							)
						}
					/>
					{occurrences && (
						<p className="m-0 border-t border-gray-200 bg-surface px-3 py-2 text-xs text-gray-500" data-testid="madeira-occurrences-note">
							{occFailed && (
								<span className="font-semibold text-amber-700 dark:text-amber-300">
									{occFresh
										? `Não foi possível atualizar as ocorrências — dados das ${hhmm(occLoadedAt)}. `
										: `Não foi possível atualizar as ocorrências desde as ${hhmm(occLoadedAt)}. `}
								</span>
							)}
							{occFresh && occurrencesNote(periodOccurrences, occWindow)}
						</p>
					)}
				</RegionCard>
			</div>
		</Layout>
	)
}

function hhmm(d) {
	return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

const SRPC = 'da Proteção Civil da Madeira (SRPC, IP-RAM)'

function occurrencesNote(list, win) {
	if (!win) return `As ocorrências ${SRPC} são acontecimentos passados: não aparecem nos dias seguintes.`
	const total = totalCount(list)
	if (total === 0) return `Sem ocorrências ${SRPC} ${win.label}.`
	const mapped = totalCount(parishGroups(list).flatMap((g) => g.occurrences))
	const missing = total - mapped
	return [
		`${total} ${total === 1 ? 'ocorrência' : 'ocorrências'} ${SRPC} ${win.label}`,
		mapped > 0 ? `: uma bolha por freguesia, localização aproximada (centroide da freguesia).` : '.',
		missing > 0 ? ` ${missing} sem localização não ${missing === 1 ? 'aparece' : 'aparecem'} no mapa.` : '',
	].join('')
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
