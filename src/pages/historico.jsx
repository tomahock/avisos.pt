import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import HistoryDayList from '../components/history/HistoryDayList.jsx'
import HistoryFilters from '../components/history/HistoryFilters.jsx'
import StateError from '../components/warnings/StateError.jsx'
import { useHistoryEvents } from '../hooks/useHistoryEvents.js'
import { HISTORY_RECORDING_SINCE, groupEventsByDay, historyApiSearch, historyNow, historyQuery } from '../utils/history.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { PAGE_META } from '../utils/share.js'

export default function HistoricoPage() {
	usePageTitle(`${PAGE_META['/historico'].title} · Avisos.pt`, {
		description: PAGE_META['/historico'].description,
	})

	const [searchParams, setSearchParams] = useSearchParams()
	const [reloadKey, setReloadKey] = useState(0)

	// Rounded "now" (historyNow) so visitors share the edge-cached response.
	const search = useMemo(
		() => historyApiSearch(historyQuery(searchParams, historyNow())),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[searchParams.toString(), reloadKey]
	)
	const { events, error } = useHistoryEvents(search, reloadKey)

	const groups = useMemo(() => (events ? groupEventsByDay(events) : []), [events])

	const onChange = useCallback(
		(patch) => {
			const next = new URLSearchParams(searchParams)
			for (const [k, v] of Object.entries(patch)) {
				if (v) next.set(k, v)
				else next.delete(k)
			}
			setSearchParams(next, { replace: true })
		},
		[searchParams, setSearchParams]
	)

	return (
		<Layout>
			<div className="px-4 mt-6">
				<header>
					<h1 className="text-2xl font-bold text-gray-900 tracking-tight">Histórico de avisos</h1>
					<p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
						Todas as alterações aos avisos do IPMA, da mais recente para a mais antiga: avisos
						emitidos, agravados, desagravados, prolongados, encurtados, retirados antes do fim e
						terminados. A hora é a da emissão do IPMA que trouxe a alteração.
					</p>
				</header>

				<HistoryFilters searchParams={searchParams} onChange={onChange} />

				{error ? (
					<StateError
						title="O histórico ainda não está disponível"
						message="Não foi possível obter o histórico de avisos. Tente de novo dentro de momentos."
						onRetry={() => setReloadKey((k) => k + 1)}
					/>
				) : events === null ? (
					<div className="mt-12 text-center">
						<i className="fas fa-spinner fa-spin text-3xl text-gray-400" aria-hidden />
						<p className="mt-3 text-gray-500">A carregar o histórico…</p>
					</div>
				) : groups.length === 0 ? (
					<div className="mt-8 border border-gray-200 rounded-xl p-8 text-center">
						<p className="font-semibold text-gray-900">Ainda não há alterações registadas neste período</p>
						<p className="mt-1 text-sm text-gray-500">
							O histórico começou a ser registado a {HISTORY_RECORDING_SINCE}.
						</p>
					</div>
				) : (
					<div className="mt-6">
						<HistoryDayList groups={groups} />
					</div>
				)}
			</div>
		</Layout>
	)
}
