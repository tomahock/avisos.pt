import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import HistoryDayList from '../history/HistoryDayList.jsx'
import HistoryPeriodTabs from '../history/HistoryPeriodTabs.jsx'
import { IPMA_AREAS } from '../../data/ipmaAreas.js'
import { useHistoryEvents } from '../../hooks/useHistoryEvents.js'
import { DEFAULT_PERIOD, HISTORY_PERIODS, HISTORY_RECORDING_SINCE, areaHistorySearch, groupEventsByDay, historyNow } from '../../utils/history.js'

const COLLAPSED = 10

// Keep the first `n` events of day groups (newest first).
function firstEvents(groups, n) {
	const out = []
	let left = n
	for (const g of groups) {
		if (left <= 0) break
		out.push({ ...g, events: g.events.slice(0, left) })
		left -= g.events.length
	}
	return out
}

// Warnings history of one area on its district page: the /historico list
// (same components, kinds and day grouping) for this area only, with its own
// period tabs (local state — the district URL stays as it is) and a link to
// the full, filterable history.
export default function DistrictHistory({ code }) {
	const area = IPMA_AREAS[code]
	const [period, setPeriod] = useState(DEFAULT_PERIOD)
	const [expanded, setExpanded] = useState(false)
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
		setPeriod(DEFAULT_PERIOD)
		setExpanded(false)
	}, [code])

	// Rounded "now" (historyNow) so visitors share the edge-cached response.
	const search = useMemo(
		() => areaHistorySearch(area.slug, period, historyNow()),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[area.slug, period, reloadKey]
	)
	const { events, error } = useHistoryEvents(search, reloadKey)
	const groups = useMemo(() => (events ? groupEventsByDay(events) : []), [events])
	const total = events?.length ?? 0
	const phrase = HISTORY_PERIODS.find((p) => p.id === period)?.phrase ?? ''

	return (
		<section className="mt-10" aria-labelledby="historico-distrito">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="historico-distrito" className="text-lg font-bold text-gray-900">Histórico de avisos</h2>
				<Link to={`/historico?regiao=${area.slug}`} className="text-sm font-medium text-primary-700">
					Ver histórico completo
				</Link>
			</div>
			<p className="mt-1 text-sm text-gray-600">Alterações aos avisos de {area.name}, da mais recente para a mais antiga.</p>

			<div className="mt-3">
				<HistoryPeriodTabs
					selected={period}
					onSelect={(id) => {
						setPeriod(id)
						setExpanded(false)
					}}
				/>
			</div>

			<div className="mt-4">
				{error ? (
					<p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
						<i className="fas fa-triangle-exclamation" aria-hidden />
						Não foi possível carregar o histórico.
						<button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">
							Tentar de novo
						</button>
					</p>
				) : events === null ? (
					<p className="text-sm text-gray-500">
						<i className="fas fa-spinner fa-spin mr-2" aria-hidden />A carregar o histórico…
					</p>
				) : total === 0 ? (
					<div className="rounded-lg border border-gray-200 bg-surface px-4 py-3 text-sm">
						<p className="m-0 text-gray-700">
							Sem alterações aos avisos de {area.name} {phrase}.
						</p>
						<p className="m-0 mt-1 text-xs text-gray-500">O histórico começou a ser registado a {HISTORY_RECORDING_SINCE}.</p>
					</div>
				) : (
					<>
						<HistoryDayList groups={expanded ? groups : firstEvents(groups, COLLAPSED)} Heading="h3" showArea={false} />
						{total > COLLAPSED && (
							<button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 text-sm font-medium text-primary-700">
								{expanded ? 'Mostrar menos' : `Mostrar as ${total} alterações`}
							</button>
						)}
					</>
				)}
			</div>
		</section>
	)
}
