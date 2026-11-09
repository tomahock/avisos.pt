import { levelMeta, worstLevelId } from '../../data/levels.js'
import { warningsInPeriod } from '../../utils/timeline.js'

function Tab({ period, warnings, isSelected, onSelect }) {
	const list = warningsInPeriod(warnings, period)
	const worst = worstLevelId(list)
	const areas = new Set(list.map((w) => w.idAreaAviso)).size
	const level = levelMeta(worst)

	return (
		<button
			type="button"
			onClick={() => onSelect(period.key)}
			aria-pressed={isSelected}
			className={`shrink-0 min-w-[7.5rem] text-left rounded-lg border px-3 py-2 transition ${
				isSelected
					? 'bg-gray-900 border-gray-900 text-white shadow-md'
					: 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
			}`}
		>
			<span className="flex items-center gap-1.5 text-sm font-bold">
				{period.key === 'agora' && (
					<span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" aria-hidden />
				)}
				{period.main}
				{period.sub && (
					<span className={`text-xs font-normal ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
						{period.sub}
					</span>
				)}
			</span>
			<span className="mt-1 flex items-center gap-1.5 text-xs">
				<span
					className={`inline-block w-2.5 h-2.5 rounded-sm ${worst ? level.bar : 'bg-gray-200'}`}
					aria-hidden
				/>
				<span className={isSelected ? 'text-gray-200' : 'text-gray-600'}>
					{areas === 0
						? 'Sem avisos'
						: `${areas} ${areas === 1 ? 'região' : 'regiões'} · ${level.label.toLowerCase()}`}
				</span>
			</span>
		</button>
	)
}

export default function MapPeriodPicker({ periods, warnings, selected, onSelect }) {
	return (
		<div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" role="group" aria-label="Período">
			{periods.map((p) => (
				<Tab
					key={p.key}
					period={p}
					warnings={warnings}
					isSelected={p.key === selected}
					onSelect={onSelect}
				/>
			))}
		</div>
	)
}
