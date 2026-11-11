import { useMemo } from 'react'
import L from 'leaflet'
import { Marker, Popup, Tooltip } from 'react-leaflet'

import { incidentKind } from '../../utils/incidents.js'
import { instant, occurrenceCount, parishGroups } from '../../utils/madeira.js'

const POPUP_MAX = 6
// Violet: distinct from the warning levels (yellow/orange/red) and the
// station markers (blue); readable on the light and the inverted dark tiles.
const FILL = '#7c3aed'

function countIcon(count) {
	const size = count >= 20 ? 34 : count >= 5 ? 28 : 22
	return L.divIcon({
		className: '',
		html: `<div data-madeira-parish style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${FILL};color:#fff;font-size:11px;font-weight:700;border:2px solid rgb(var(--surface));box-shadow:0 1px 4px rgba(15,23,42,.4)">${count}</div>`,
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
	})
}

function hhmm(iso) {
	const d = instant(iso)
	return d ? d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}

// One marker per parish with SRPC, IP-RAM occurrences (Madeira), at the
// parish centroid FogosPT attaches — an approximate location, said so in the
// popup. Occurrences without coordinates are skipped by parishGroups().
// <div>, not <p>: leaflet.css gives popup paragraphs 1.3em margins that
// outrank Tailwind's m-0.
export default function MadeiraOccurrencesLayer({ occurrences, windowLabel }) {
	const groups = useMemo(() => parishGroups(occurrences), [occurrences])
	return groups.map((g) => {
		const shown = g.occurrences.slice(0, POPUP_MAX)
		const more = g.occurrences.length - shown.length
		const name = g.parish ?? g.municipality ?? 'Freguesia desconhecida'
		return (
			<Marker key={g.key} position={[g.lat, g.lng]} icon={countIcon(g.count)} riseOnHover>
				<Tooltip direction="top" offset={[0, -12]}>
					<strong>{name}</strong>: {g.count} {g.count === 1 ? 'ocorrência' : 'ocorrências'}
				</Tooltip>
				<Popup maxHeight={240}>
					<div className="min-w-[220px] max-w-[280px]">
						<div className="font-bold text-gray-900 m-0">{name}</div>
						{g.municipality && g.parish && <div className="text-xs text-gray-600 m-0">{g.municipality}</div>}
						<div className="text-xs text-gray-500 mt-1 mb-2">
							{g.count} {g.count === 1 ? 'ocorrência' : 'ocorrências'} {windowLabel} · localização aproximada (freguesia)
						</div>
						<ul className="list-none m-0 p-0 space-y-1.5">
							{shown.map((o) => {
								const copies = occurrenceCount(o)
								return (
									<li key={o.id} className="flex gap-2 items-start">
										<i className={`fas ${incidentKind(o.nature).icon} mt-0.5 text-xs text-gray-500`} aria-hidden />
										<div className="min-w-0">
											<div className="text-xs font-semibold text-gray-900 m-0">
												{o.nature ?? 'Ocorrência'}
												{copies > 1 ? ` ×${copies}` : ''}
											</div>
											<div className="text-[10px] text-gray-500 m-0">{hhmm(o.start)}</div>
										</div>
									</li>
								)
							})}
						</ul>
						{more > 0 && <div className="text-xs text-gray-500 mt-1.5 mb-0">e mais {more}</div>}
						<div className="text-[10px] text-gray-400 mt-2 mb-0">Fonte: SRPC, IP-RAM, via Fogos.pt</div>
					</div>
				</Popup>
			</Marker>
		)
	})
}
