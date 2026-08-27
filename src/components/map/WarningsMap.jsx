import { useEffect, useMemo, useRef } from 'react'
import {
	CircleMarker,
	GeoJSON,
	LayerGroup,
	LayersControl,
	MapContainer,
	Popup,
	TileLayer,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import MapLegend from './MapLegend.jsx'
import { codeFromDisName } from '../../data/ipmaAreas.js'
import { LEVELS, levelMeta, worstLevelId } from '../../data/levels.js'
import { warningTypeMeta } from '../../data/warningTypes.js'
import {
	formatHumidity,
	formatPrecip,
	formatTemp,
	formatWhen,
	formatWind,
} from '../../utils/format.js'

const PT_CENTER = [39.6, -8.2]
const PT_ZOOM = 7

function esc(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function districtPopupHtml(name, warnings) {
	if (!warnings || warnings.length === 0) {
		return `<div class="min-w-[200px]"><p class="font-bold text-gray-900 m-0">${esc(name)}</p><p class="text-xs text-gray-500 mt-1 mb-0">Sem avisos em vigor.</p></div>`
	}
	const items = warnings
		.map((w) => {
			const lvl = levelMeta(w.awarenessLevelID)
			const type = warningTypeMeta(w.awarenessTypeName)
			return `
				<li class="flex gap-2 items-start">
					<span class="inline-block w-2 h-2 mt-1.5 rounded-sm" style="background:${lvl.fill}"></span>
					<div class="min-w-0">
						<p class="text-sm font-semibold text-gray-900 m-0">${esc(type.label ?? w.awarenessTypeName)}</p>
						<p class="text-xs text-gray-600 mt-0.5 mb-0">${esc(w.text ?? '')}</p>
						<p class="text-[10px] text-gray-400 mt-0.5 mb-0">${esc(formatWhen(w.startTime))} → ${esc(formatWhen(w.endTime))}</p>
					</div>
				</li>
			`
		})
		.join('')
	return `
		<div class="min-w-[240px] max-w-[280px]">
			<p class="font-bold text-gray-900 m-0 mb-2">${esc(name)}</p>
			<ul class="list-none m-0 p-0 space-y-2">${items}</ul>
		</div>
	`
}

function districtStyle(feature, warningsByCode) {
	const disName = feature.properties.dis_name
	const code = codeFromDisName(disName)
	const list = code ? warningsByCode.get(code) : null
	const worst = list ? worstLevelId(list) : null
	const fill = worst ? LEVELS[worst].fill : '#ffffff'
	const opacity = worst ? 0.55 : 0.15
	return {
		fillColor: fill,
		fillOpacity: opacity,
		color: worst ? LEVELS[worst].fill : '#94a3b8',
		weight: worst ? 1 : 0.5,
		opacity: worst ? 0.9 : 0.5,
	}
}

function StationMarker({ feature, obs }) {
	const props = feature.properties
	const [lng, lat] = feature.geometry.coordinates
	const id = String(props.idEstacao)
	const stationObs = obs[id]
	return (
		<CircleMarker
			center={[lat, lng]}
			radius={5}
			pathOptions={{
				color: '#1d4ed8',
				weight: 1.5,
				fillColor: '#3b82f6',
				fillOpacity: 0.8,
			}}
		>
			<Popup>
				<div className="min-w-[180px]">
					<p className="font-semibold text-gray-900 m-0">{props.localEstacao}</p>
					{stationObs ? (
						<ObservationList obs={stationObs} />
					) : (
						<p className="text-xs text-gray-500 mt-1 mb-0">Sem leituras nesta hora.</p>
					)}
				</div>
			</Popup>
		</CircleMarker>
	)
}

function ObservationList({ obs }) {
	const rows = [
		['Temperatura', formatTemp(obs.temperatura)],
		['Vento', formatWind(obs.intensidadeVentoKM, obs.idDireccVento)],
		['Precipitação', formatPrecip(obs.precAcumulada)],
		['Humidade', formatHumidity(obs.humidade)],
	].filter((r) => r[1] !== null)
	if (rows.length === 0) {
		return <p className="text-xs text-gray-500 mt-1 mb-0">Sem leituras válidas.</p>
	}
	return (
		<ul className="list-none m-0 p-0 mt-2 space-y-1 text-xs">
			{rows.map(([k, v]) => (
				<li key={k} className="flex justify-between gap-3">
					<span className="text-gray-500">{k}</span>
					<span className="text-gray-900 font-medium">{v}</span>
				</li>
			))}
		</ul>
	)
}

// Rebuild the GeoJSON layer whenever warnings change (Leaflet doesn't re-run
// styleFn otherwise). Cheap enough — the geometry is already parsed.
function DistrictLayer({ geojson, warningsByCode }) {
	const style = useMemo(
		() => (feature) => districtStyle(feature, warningsByCode),
		[warningsByCode]
	)
	const onEachFeature = useMemo(
		() => (feature, layer) => {
			const disName = feature.properties.dis_name
			const code = codeFromDisName(disName)
			const list = code ? warningsByCode.get(code) : null
			layer.bindPopup(districtPopupHtml(disName, list))
		},
		[warningsByCode]
	)
	// Force re-render (react-leaflet's GeoJSON caches the style otherwise).
	const key = useMemo(() => {
		const parts = []
		for (const [code, list] of warningsByCode) parts.push(`${code}:${list.length}`)
		return parts.sort().join('|')
	}, [warningsByCode])
	return (
		<GeoJSON key={key} data={geojson} style={style} onEachFeature={onEachFeature} />
	)
}

export default function WarningsMap({ geojson, warnings, stations, observations }) {
	const warningsByCode = useMemo(() => {
		const map = new Map()
		for (const w of warnings) {
			const list = map.get(w.idAreaAviso)
			if (list) list.push(w)
			else map.set(w.idAreaAviso, [w])
		}
		return map
	}, [warnings])

	const mapRef = useRef(null)
	// Prevents the map from rendering blank when the container becomes visible
	// after being mounted inside `display:none` or a modal.
	useEffect(() => {
		if (mapRef.current) {
			mapRef.current.invalidateSize()
		}
	}, [])

	return (
		<div className="relative w-full h-[75vh] min-h-[500px]">
			<MapContainer
				center={PT_CENTER}
				zoom={PT_ZOOM}
				scrollWheelZoom
				className="w-full h-full"
				ref={mapRef}
			>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>
				<LayersControl position="topleft">
					<LayersControl.Overlay checked name="Avisos por distrito">
						<LayerGroup>
							<DistrictLayer geojson={geojson} warningsByCode={warningsByCode} />
						</LayerGroup>
					</LayersControl.Overlay>
					<LayersControl.Overlay name="Estações meteorológicas">
						<LayerGroup>
							{stations.map((f) => (
								<StationMarker
									key={f.properties.idEstacao}
									feature={f}
									obs={observations}
								/>
							))}
						</LayerGroup>
					</LayersControl.Overlay>
				</LayersControl>
			</MapContainer>
			<MapLegend />
		</div>
	)
}
