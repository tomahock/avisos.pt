import { LEVELS } from '../../data/levels.js'
import { SEA_BAND_KM } from '../../data/seaAreas.js'

const ORDER = ['red', 'orange', 'yellow']

function Swatch({ id }) {
	return <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: LEVELS[id].fill }} />
}

function NoWarningSwatch() {
	return <span className="inline-block w-3 h-3 rounded-sm shrink-0 border border-gray-300 bg-surface" />
}

// Two layouts of the same legend:
// - "overlay" (default): box over the map's top-right corner, sm+ only.
// - "strip": compact row under the map on phones, where an overlay would
//   cover a big chunk of the map and the popups' close button.
export default function MapLegend({ variant = 'overlay' }) {
	if (variant === 'strip') {
		return (
			<div className="sm:hidden border-t border-gray-200 bg-surface px-3 py-2 text-xs" data-testid="map-legend-strip">
				<p className="sr-only">Nível de aviso</p>
				<ul className="flex flex-wrap items-center gap-x-3 gap-y-1 m-0 p-0 list-none">
					{ORDER.map((id) => (
						<li key={id} className="flex items-center gap-1.5">
							<Swatch id={id} />
							<span className="text-gray-700">{LEVELS[id].label}</span>
						</li>
					))}
					<li className="flex items-center gap-1.5">
						<NoWarningSwatch />
						<span className="text-gray-500">Sem aviso</span>
					</li>
					<li className="flex items-center gap-1.5 text-gray-600">
						<i className="fas fa-water text-gray-500" aria-hidden />
						<span>Faixa no mar ({SEA_BAND_KM} km): agitação marítima</span>
					</li>
				</ul>
			</div>
		)
	}

	return (
		<div className="hidden sm:block absolute top-3 right-3 z-[500] bg-surface/95 backdrop-blur rounded-md shadow-md border border-gray-200 px-3 py-2 text-xs" data-testid="map-legend">
			<p className="font-semibold text-gray-700 mb-1">Nível de aviso</p>
			<ul className="space-y-1 m-0 p-0 list-none">
				{ORDER.map((id) => (
					<li key={id} className="flex items-center gap-2">
						<Swatch id={id} />
						<span className="text-gray-700">{LEVELS[id].label}</span>
					</li>
				))}
				<li className="flex items-center gap-2">
					<NoWarningSwatch />
					<span className="text-gray-500">Sem aviso</span>
				</li>
			</ul>
			<p className="mt-2 mb-0 flex items-center gap-2 border-t border-gray-200 pt-1.5 text-gray-600">
				<i className="fas fa-water text-gray-500" aria-hidden />
				<span>
					Faixa no mar ({SEA_BAND_KM} km):
					<br />
					agitação marítima
				</span>
			</p>
		</div>
	)
}
