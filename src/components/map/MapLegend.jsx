import { LEVELS } from '../../data/levels.js'

const ORDER = ['red', 'orange', 'yellow']

export default function MapLegend() {
	return (
		<div className="absolute top-3 right-3 z-[500] bg-white/95 backdrop-blur rounded-md shadow-md border border-gray-200 px-3 py-2 text-xs">
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
					<span className="inline-block w-3 h-3 rounded-sm border border-gray-300 bg-white" />
					<span className="text-gray-500">Sem aviso</span>
				</li>
			</ul>
		</div>
	)
}
