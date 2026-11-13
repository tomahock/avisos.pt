import { levelMeta, worstLevelId } from '../../data/levels.js'
import { warningsInPeriod } from '../../utils/timeline.js'

const count = (list) => new Set(list.map((w) => w.idAreaAviso)).size

// "3 regiões · 5 zonas em Espanha · laranja" — only the parts that exist.
function badgeText(areas, zones, level) {
	const parts = []
	if (areas > 0) parts.push(`${areas} ${areas === 1 ? 'região' : 'regiões'}`)
	if (zones > 0) parts.push(`${zones} ${zones === 1 ? 'zona' : 'zonas'} em Espanha`)
	if (parts.length === 0) return 'Sem avisos'
	return [...parts, level.label.toLowerCase()].join(' · ')
}

function Tab({ period, warnings, spainWarnings, isSelected, onSelect }) {
	const list = warningsInPeriod(warnings, period)
	const spain = warningsInPeriod(spainWarnings, period)
	// Worst level over both countries.
	const worst = worstLevelId([...list, ...spain])
	const level = levelMeta(worst)

	return (
		<button
			type="button"
			onClick={() => onSelect(period.key)}
			aria-pressed={isSelected}
			className={`shrink-0 min-w-[7.5rem] text-left rounded-lg border px-3 py-2 transition ${
				isSelected
					? 'bg-gray-900 border-gray-900 text-gray-50 shadow-md'
					: 'bg-surface border-gray-200 text-gray-900 hover:border-gray-300 hover:bg-gray-50'
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
					{badgeText(count(list), count(spain), level)}
				</span>
			</span>
		</button>
	)
}

export default function MapPeriodPicker({ periods, warnings, spainWarnings = [], selected, onSelect }) {
	return (
		<div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" role="group" aria-label="Período">
			{periods.map((p) => (
				<Tab
					key={p.key}
					period={p}
					warnings={warnings}
					spainWarnings={spainWarnings}
					isSelected={p.key === selected}
					onSelect={onSelect}
				/>
			))}
		</div>
	)
}
