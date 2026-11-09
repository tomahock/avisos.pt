import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import {
	CircleMarker,
	GeoJSON,
	LayerGroup,
	LayersControl,
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	Tooltip,
	useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import MapLegend from './MapLegend.jsx'
import { IPMA_AREAS, codeFromContinentalName } from '../../data/ipmaAreas.js'
import { codeForFeature } from '../../data/islandConcelhos.js'
import { LEVELS, levelMeta, worstLevelId } from '../../data/levels.js'
import { typeRank, warningTypeMeta } from '../../data/warningTypes.js'
import {
	formatHumidity,
	formatPrecip,
	formatTemp,
	formatWhen,
	formatWind,
} from '../../utils/format.js'
import { districtPath } from '../../utils/share.js'

function esc(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function districtLinkHtml(code) {
	if (!code) return ''
	return `<a href="${esc(districtPath(code))}" class="inline-block mt-2 text-xs font-semibold text-primary-700">Ver página de ${esc(IPMA_AREAS[code]?.name ?? code)} →</a>`
}

function districtPopupHtml(title, warnings, emptyText, code) {
	if (!warnings || warnings.length === 0) {
		return `<div class="min-w-[200px]"><p class="font-bold text-gray-900 m-0">${esc(title)}</p><p class="text-xs text-gray-500 mt-1 mb-0">${esc(emptyText)}</p>${districtLinkHtml(code)}</div>`
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
			<p class="font-bold text-gray-900 m-0 mb-2">${esc(title)}</p>
			<ul class="list-none m-0 p-0 space-y-2">${items}</ul>
			${districtLinkHtml(code)}
		</div>
	`
}

function districtStyle(feature, warningsByCode) {
	const code = codeForFeature(feature, codeFromContinentalName)
	const list = code ? warningsByCode.get(code) : null
	const worst = list ? worstLevelId(list) : null
	const fill = worst ? LEVELS[worst].fill : '#ffffff'
	return {
		fillColor: fill,
		fillOpacity: worst ? 0.55 : 0.15,
		color: worst ? LEVELS[worst].fill : '#94a3b8',
		weight: worst ? 1 : 0.5,
		opacity: worst ? 0.9 : 0.5,
	}
}

function DistrictLayer({ geojson, warningsByCode, emptyText }) {
	const style = useMemo(
		() => (feature) => districtStyle(feature, warningsByCode),
		[warningsByCode]
	)
	const onEachFeature = useMemo(
		() => (feature, layer) => {
			const code = codeForFeature(feature, codeFromContinentalName)
			const list = code ? warningsByCode.get(code) : null
			const title = code
				? IPMA_AREAS[code]?.name ?? feature.properties.con_name
				: feature.properties.con_name
			layer.bindPopup(districtPopupHtml(title, list, emptyText, code))
		},
		[warningsByCode, emptyText]
	)
	// Force re-render when the warnings set changes (react-leaflet's GeoJSON
	// caches the style function and popups otherwise). Includes level + start
	// so switching period remounts even when per-area counts happen to match.
	const key = useMemo(() => {
		const parts = [emptyText]
		for (const [code, list] of warningsByCode) {
			parts.push(`${code}:${list.map((w) => `${w.awarenessLevelID}@${w.startTime}`).join(',')}`)
		}
		return parts.sort().join('|')
	}, [warningsByCode, emptyText])
	return (
		<GeoJSON key={key} data={geojson} style={style} onEachFeature={onEachFeature} />
	)
}

// --- Warning-type icons ---------------------------------------------------
// One marker per area with warnings in the selected period: a pill of FA
// icons, one per warning type, each filled with that type's worst level.
// Font Awesome is loaded globally (index.html), so plain <i> tags work inside
// a Leaflet divIcon.

const ICON_PX = 22
const ICON_GAP = 2
const MAX_ICONS = 4
// Below this zoom the pills pile on top of each other — hide them and let
// the polygon colours speak.
const MIN_ICON_ZOOM = 6
// Readable glyph colour on each level fill (yellow needs dark text).
const ICON_INK = { yellow: '#0f172a', orange: '#ffffff', red: '#ffffff' }

// Anchor for an area's icon pill. Continental districts: centre of the
// bounding box of all their municipalities, so the icon sits inside the
// district rather than on the (often coastal) capital. Island groups: centre
// of the largest polygon — the group's bbox centre lands in the sea between
// islands. Areas without polygons (MRM) fall back to IPMA_AREAS lat/lng.
function bboxOf(coords, box = [Infinity, Infinity, -Infinity, -Infinity]) {
	if (typeof coords[0] === 'number') {
		box[0] = Math.min(box[0], coords[0])
		box[1] = Math.min(box[1], coords[1])
		box[2] = Math.max(box[2], coords[0])
		box[3] = Math.max(box[3], coords[1])
	} else {
		for (const c of coords) bboxOf(c, box)
	}
	return box
}

const bboxArea = (b) => (b[2] - b[0]) * (b[3] - b[1])
const bboxCentre = (b) => [(b[1] + b[3]) / 2, (b[0] + b[2]) / 2]

function areaAnchors(geojson) {
	const union = new Map()
	const largest = new Map()
	for (const f of geojson?.features ?? []) {
		const code = codeForFeature(f, codeFromContinentalName)
		if (!code || !f.geometry) continue
		const box = bboxOf(f.geometry.coordinates)
		const u = union.get(code)
		union.set(code, u ? [Math.min(u[0], box[0]), Math.min(u[1], box[1]), Math.max(u[2], box[2]), Math.max(u[3], box[3])] : box)
		const l = largest.get(code)
		if (!l || bboxArea(box) > bboxArea(l)) largest.set(code, box)
	}
	const anchors = new Map()
	for (const [code, box] of union) {
		const island = IPMA_AREAS[code]?.region !== 'continental'
		anchors.set(code, bboxCentre(island ? largest.get(code) : box))
	}
	return anchors
}

// [{ type, level }] — worst level per type, in IPMA legend order.
function typesWithLevel(list) {
	const byType = new Map()
	for (const w of list) {
		const cur = byType.get(w.awarenessTypeName)
		const p = LEVELS[w.awarenessLevelID]?.priority ?? 0
		if (!cur || p > (LEVELS[cur]?.priority ?? 0)) byType.set(w.awarenessTypeName, w.awarenessLevelID)
	}
	return [...byType.entries()]
		.sort((a, b) => typeRank(a[0]) - typeRank(b[0]))
		.map(([type, level]) => ({ type, level }))
}

function warningIcon(items) {
	const shown = items.slice(0, MAX_ICONS)
	const extra = items.length - shown.length
	const cells = shown.map(({ type, level }) => {
		const meta = warningTypeMeta(type)
		return `<span title="${esc(`${meta.label ?? type} — ${levelMeta(level).label}`)}" style="display:flex;align-items:center;justify-content:center;width:${ICON_PX}px;height:${ICON_PX}px;border-radius:6px;background:${LEVELS[level]?.fill ?? '#94a3b8'};color:${ICON_INK[level] ?? '#fff'};font-size:11px"><i class="fas ${meta.icon}"></i></span>`
	})
	if (extra > 0) {
		cells.push(`<span style="display:flex;align-items:center;justify-content:center;height:${ICON_PX}px;padding:0 4px;font-size:11px;font-weight:700;color:#334155">+${extra}</span>`)
	}
	const width = shown.length * ICON_PX + (shown.length - 1) * ICON_GAP + (extra > 0 ? 24 : 0) + 6
	const height = ICON_PX + 6
	return L.divIcon({
		className: '',
		html: `<div style="display:flex;gap:${ICON_GAP}px;padding:3px;background:#fff;border-radius:9px;box-shadow:0 1px 4px rgba(15,23,42,.35)">${cells.join('')}</div>`,
		iconSize: [width, height],
		iconAnchor: [width / 2, height / 2],
	})
}

function WarningIconsLayer({ geojson, warningsByCode, bounds, emptyText }) {
	const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
	const [zoom, setZoom] = useState(() => map.getZoom())
	const anchors = useMemo(() => areaAnchors(geojson), [geojson])
	const markers = useMemo(() => {
		const out = []
		for (const [code, list] of warningsByCode) {
			const area = IPMA_AREAS[code]
			const pos = anchors.get(code) ?? (area ? [area.lat, area.lng] : null)
			if (!pos || !inBounds([pos[1], pos[0]], bounds)) continue
			const items = typesWithLevel(list)
			out.push({
				code,
				pos,
				icon: warningIcon(items),
				summary: items
					.map(({ type, level }) => `${warningTypeMeta(type).label ?? type} (${levelMeta(level).label.toLowerCase()})`)
					.join(', '),
				popup: districtPopupHtml(area?.name ?? code, list, emptyText, code),
			})
		}
		return out
	}, [warningsByCode, anchors, bounds, emptyText])

	if (zoom < MIN_ICON_ZOOM) return null

	return markers.map((m) => (
		<Marker key={m.code} position={m.pos} icon={m.icon} riseOnHover>
			<Tooltip direction="top" offset={[0, -14]}>
				<strong>{IPMA_AREAS[m.code]?.name ?? m.code}</strong>: {m.summary}
			</Tooltip>
			<Popup>
				<div dangerouslySetInnerHTML={{ __html: m.popup }} />
			</Popup>
		</Marker>
	))
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
						<p className="text-xs text-gray-500 mt-1 mb-0">
							Sem leituras nesta hora.
						</p>
					)}
				</div>
			</Popup>
		</CircleMarker>
	)
}

function inBounds(coords, bounds) {
	if (!bounds) return true
	const [lng, lat] = coords
	return (
		lat >= bounds.latMin &&
		lat <= bounds.latMax &&
		lng >= bounds.lngMin &&
		lng <= bounds.lngMax
	)
}

export default function WarningsMap({
	geojson,
	warnings,
	stations,
	observations,
	center,
	zoom,
	bounds,
	height = 'h-[75vh] min-h-[500px]',
	showLegend = true,
	stationsChecked = false,
	emptyText = 'Sem avisos em vigor.',
}) {
	const warningsByCode = useMemo(() => {
		const map = new Map()
		for (const w of warnings) {
			const list = map.get(w.idAreaAviso)
			if (list) list.push(w)
			else map.set(w.idAreaAviso, [w])
		}
		return map
	}, [warnings])

	const filteredStations = useMemo(
		() => stations.filter((f) => inBounds(f.geometry?.coordinates, bounds)),
		[stations, bounds]
	)

	const mapRef = useRef(null)
	useEffect(() => {
		if (mapRef.current) mapRef.current.invalidateSize()
	}, [])

	return (
		<div className={`relative w-full ${height}`}>
			<MapContainer
				center={center}
				zoom={zoom}
				scrollWheelZoom
				className="w-full h-full"
				ref={mapRef}
			>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>
				<LayersControl position="topleft">
					<LayersControl.Overlay checked name="Avisos por região">
						<LayerGroup>
							<DistrictLayer
								geojson={geojson}
								warningsByCode={warningsByCode}
								emptyText={emptyText}
							/>
						</LayerGroup>
					</LayersControl.Overlay>
					<LayersControl.Overlay checked name="Ícones dos avisos">
						<LayerGroup>
							<WarningIconsLayer
								geojson={geojson}
								warningsByCode={warningsByCode}
								bounds={bounds}
								emptyText={emptyText}
							/>
						</LayerGroup>
					</LayersControl.Overlay>
					<LayersControl.Overlay checked={stationsChecked} name="Estações meteorológicas">
						<LayerGroup>
							{filteredStations.map((f) => (
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
			{showLegend && <MapLegend />}
		</div>
	)
}
