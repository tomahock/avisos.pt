import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import HistoryEvent from '../components/history/HistoryEvent.jsx'
import HistoryFilters from '../components/history/HistoryFilters.jsx'
import StateError from '../components/warnings/StateError.jsx'
import { fetchJson } from '../utils/fetchJson.js'
import { groupEventsByDay, historyApiSearch, historyQuery } from '../utils/history.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { PAGE_META } from '../utils/share.js'

// FogosPT started recording warning events on this date — nothing before it.
const RECORDING_SINCE = '11 de novembro de 2026'

// Rounded so visitors in the same 5 minutes share the edge-cached response.
const BUCKET_MS = 5 * 60 * 1000

function dayLabel(day) {
	const [y, m, d] = day.split('-').map(Number)
	return new Date(y, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function HistoricoPage() {
	usePageTitle(`${PAGE_META['/historico'].title} · Avisos.pt`, {
		description: PAGE_META['/historico'].description,
	})

	const [searchParams, setSearchParams] = useSearchParams()
	const [events, setEvents] = useState(null)
	const [error, setError] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)

	const search = useMemo(() => {
		const now = new Date(Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS)
		return historyApiSearch(historyQuery(searchParams, now))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams.toString(), reloadKey])

	useEffect(() => {
		const ctrl = new AbortController()
		setEvents(null)
		setError(null)
		fetchJson(`/api/warnings/history?${search}`, ctrl.signal)
			.then((data) => setEvents(Array.isArray(data) ? data : []))
			.catch((err) => {
				if (err.name !== 'AbortError') setError(err.message)
			})
		return () => ctrl.abort()
	}, [search, reloadKey])

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
							O histórico começou a ser registado a {RECORDING_SINCE}.
						</p>
					</div>
				) : (
					<div className="mt-6 flex flex-col gap-6">
						{groups.map((g) => (
							<section key={g.day}>
								<h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 first-letter:uppercase">
									{dayLabel(g.day)}
								</h2>
								<ol className="mt-2 bg-surface border border-gray-200 rounded-lg px-3 list-none m-0">
									{g.events.map((e) => (
										<HistoryEvent key={e.id} event={e} />
									))}
								</ol>
							</section>
						))}
					</div>
				)}
			</div>
		</Layout>
	)
}
