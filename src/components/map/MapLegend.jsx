import { LEVELS } from '../../data/levels.js'
import { SEA_BAND_KM } from '../../data/seaAreas.js'

const ORDER = ['red', 'orange', 'yellow']

export default function MapLegend({ showSpain = false }) {
	return (
		<div className="absolute top-3 right-3 z-[500] bg-surface/95 backdrop-blur rounded-md shadow-md border border-gray-200 px-3 py-2 text-xs">
			<p className="font-semibold text-gray-700 mb-1">Nível de aviso</p>
			<ul className="space-y-1 m-0 p-0 list-none">
				{ORDER.map((id) => (
					<li key={id} className="flex items-center gap-2">
						<span
							className="inline-block w-3 h-3 rounded-sm"
							style={{ backgroundColor: LEVELS[id].fill }}
						/>
						<span className="text-gray-700">{LEVELS[id].label}</span>
					</li>
				))}
				<li className="flex items-center gap-2">
					<span className="inline-block w-3 h-3 rounded-sm border border-gray-300 bg-surface" />
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
			{showSpain && (
				<p className="mt-1.5 mb-0 flex items-center gap-2 border-t border-gray-200 pt-1.5 text-gray-600">
					<span className="inline-block w-3 h-3 rounded-sm border border-[#57534e] bg-[#a8a29e]/35 dark:border-[#a8a29e]" aria-hidden />
					<span>Espanha: avisos da AEMET</span>
				</p>
			)}
		</div>
	)
}
