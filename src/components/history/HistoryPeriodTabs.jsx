import { HISTORY_PERIODS } from '../../utils/history.js'

// 24 h / 3 dias / 7 dias / 30 dias. `selected` = a period id, or null when a
// custom range is in use (no tab active).
export default function HistoryPeriodTabs({ selected, onSelect }) {
	return (
		<div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit max-w-full overflow-x-auto" role="tablist" aria-label="Período">
			{HISTORY_PERIODS.map((p) => {
				const active = p.id === selected
				return (
					<button
						key={p.id}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onSelect(p.id)}
						className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-semibold transition ${
							active ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
						}`}
					>
						{p.label}
					</button>
				)
			})}
		</div>
	)
}
