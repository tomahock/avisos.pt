import HistoryEvent from './HistoryEvent.jsx'
import { historyDayLabel } from '../../utils/history.js'

// Events grouped by day (groupEventsByDay), newest first. `Heading` is the
// day title's tag (h2 on /historico, h3 inside a district section);
// `showArea` is off on a district page, where every event is that area's.
export default function HistoryDayList({ groups, Heading = 'h2', showArea = true }) {
	return (
		<div className="flex flex-col gap-6">
			{groups.map((g) => (
				<section key={g.day}>
					<Heading className="text-sm font-bold uppercase tracking-wide text-gray-500 first-letter:uppercase">
						{historyDayLabel(g.day)}
					</Heading>
					<ol className="mt-2 bg-surface border border-gray-200 rounded-lg px-3 list-none m-0">
						{g.events.map((e) => (
							<HistoryEvent key={e.id} event={e} showArea={showArea} />
						))}
					</ol>
				</section>
			))}
		</div>
	)
}
