import { useEffect, useMemo, useState } from 'react'

import MadeiraEventPanel from './MadeiraEventPanel.jsx'
import { IPMA_AREAS } from '../../data/ipmaAreas.js'
import { useMadeiraSrpc } from '../../hooks/useMadeiraSrpc.js'
import { useNow } from '../../hooks/useNow.js'
import { relativeMinutes } from '../../utils/format.js'
import { incidentKind } from '../../utils/incidents.js'
import {
	activeEvent,
	areaOccurrences,
	instant,
	isMadeiraArea,
	newestFirst,
	occurrenceCount,
	totalCount,
	unplacedOccurrences,
} from '../../utils/madeira.js'

// Past this age a snapshot is too old to show at all (FogosPT outage).
const MAX_STALE_MS = 15 * 60 * 1000
const COLLAPSED = 8

function plural(n, one, many) {
	return `${n} ${n === 1 ? one : many}`
}

function hhmm(d) {
	return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

// A part of the data is usable if it loaded once and, when the latest
// refresh failed, the last good copy is still recent.
function usable(loadedAt, failed, now) {
	if (!loadedAt) return false
	return !failed || now - loadedAt.getTime() <= MAX_STALE_MS
}

function OccurrenceItem({ o }) {
	const kind = incidentKind(o.nature)
	const where = [o.municipality, o.parish].filter(Boolean)
	const start = instant(o.start)
	const copies = occurrenceCount(o)
	const means = [
		o.firefighters > 0 && plural(o.firefighters, 'operacional', 'operacionais'),
		o.vehicles > 0 && plural(o.vehicles, 'veículo', 'veículos'),
	].filter(Boolean)
	return (
		<li className="flex gap-3 px-4 py-3">
			<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
				<i className={`fas ${kind.icon}`} aria-hidden />
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span className="text-sm font-semibold text-gray-900">{o.nature ?? 'Ocorrência'}</span>
					{copies > 1 && (
						<span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-700" title="Registada mais do que uma vez pela SRPC">
							×{copies}
						</span>
					)}
				</div>
				<p className="m-0 mt-0.5 truncate text-xs text-gray-600" title={where.join(' · ')}>
					{where.length > 0 ? where.join(' · ') : 'Local não indicado'}
				</p>
				<p className="m-0 mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
					{start && (
						<span title={start.toLocaleString('pt-PT')}>
							{relativeMinutes(start)} ({hhmm(start)})
						</span>
					)}
					{means.length > 0 && <span>{means.join(' · ')}</span>}
				</p>
			</div>
		</li>
	)
}

// Madeira area pages: what SRPC, IP-RAM (the regional civil protection) has
// open — the adverse-weather event, if any, and the area's occurrences of the
// last 24 h. The continental equivalent is DistrictIncidents (ANEPC).
export default function MadeiraOccurrences({ code }) {
	const madeira = isMadeiraArea(code)
	const { event, occurrences, loadedAt, failed } = useMadeiraSrpc({ enabled: madeira })
	const now = useNow().getTime()
	const [expanded, setExpanded] = useState(false)

	useEffect(() => setExpanded(false), [code])

	const list = useMemo(() => newestFirst(areaOccurrences(occurrences, code)), [occurrences, code])
	const unplaced = useMemo(() => totalCount(unplacedOccurrences(occurrences)), [occurrences])
	const kinds = useMemo(() => {
		const m = new Map()
		for (const o of list) {
			const k = incidentKind(o.nature)
			m.set(k.label, { ...k, n: (m.get(k.label)?.n ?? 0) + occurrenceCount(o) })
		}
		return [...m.values()].sort((a, b) => b.n - a.n)
	}, [list])

	if (!madeira) return null
	const showEvent = usable(loadedAt.event, failed.event, now) && activeEvent(event)
	const showList = usable(loadedAt.occurrences, failed.occurrences, now)
	if (!showEvent && !showList) return null

	const area = IPMA_AREAS[code]
	const where = code === 'MRM' ? 'na ilha da Madeira' : `em ${area.name}`
	const total = totalCount(list)
	const stale = showList && failed.occurrences
	const loadedTime = showList ? hhmm(loadedAt.occurrences) : null
	const shown = expanded ? list : list.slice(0, COLLAPSED)

	return (
		<section id="ocorrencias-srpc" className="mt-10" aria-labelledby="ocorrencias-srpc-titulo">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="ocorrencias-srpc-titulo" className="text-lg font-bold text-gray-900">Ocorrências SRPC-RAM</h2>
				<span className="text-xs text-gray-500">Proteção Civil da Madeira, últimas 24 h</span>
			</div>

			{showEvent && <MadeiraEventPanel event={event} code={code} />}

			{showList && (
				<>
					{code === 'MRM' && (
						<p className="mt-3 text-xs text-gray-500">
							As Regiões Montanhosas atravessam vários concelhos e a SRPC só indica o concelho e a freguesia de cada ocorrência:
							aqui aparecem as de toda a ilha da Madeira (Costa Norte e Costa Sul).
						</p>
					)}
					{stale && (
						<p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
							<i className="fas fa-triangle-exclamation" aria-hidden />
							Não foi possível atualizar as ocorrências — dados das {loadedTime}.
						</p>
					)}
					{list.length === 0 ? (
						<p className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-600">
							<i className="fas fa-check text-green-600 dark:text-green-400" aria-hidden />
							Sem ocorrências registadas pela proteção civil nas últimas 24 h {where}.
						</p>
					) : (
						<>
							<p className="mt-3 text-sm text-gray-600">
								{plural(total, 'ocorrência', 'ocorrências')} nas últimas 24 h {where}
								{stale ? ` (às ${loadedTime})` : ''}
							</p>
							<ul className="mt-3 flex flex-wrap gap-2 list-none m-0 p-0">
								{kinds.map((k) => (
									<li key={k.label} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-surface px-3 py-1 text-xs font-medium text-gray-700">
										<i className={`fas ${k.icon} text-gray-500`} aria-hidden />
										{k.label}
										<span className="font-bold text-gray-900 tabular-nums">{k.n}</span>
									</li>
								))}
							</ul>
							<ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-surface list-none m-0 p-0" aria-label={`Ocorrências ${where}`}>
								{shown.map((o) => (
									<OccurrenceItem key={o.id} o={o} />
								))}
							</ul>
							{list.length > COLLAPSED && (
								<button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 text-sm font-medium text-primary-700">
									{expanded ? 'Mostrar menos' : `Ver todas as ${list.length} ocorrências`}
								</button>
							)}
						</>
					)}
					{unplaced > 0 && (
						<p className="mt-2 text-xs text-gray-500">
							{unplaced === 1
								? 'Uma ocorrência da Região não tem concelho indicado e não aparece aqui.'
								: `${unplaced} ocorrências da Região não têm concelho indicado e não aparecem aqui.`}
						</p>
					)}
				</>
			)}
			<p className="mt-2 text-xs text-gray-500">
				Fonte: <a href="https://www.procivmadeira.pt" target="_blank" rel="noreferrer" className="text-gray-600">SRPC, IP-RAM</a>, via{' '}
				<a href="https://fogos.pt" target="_blank" rel="noreferrer" className="text-gray-600">Fogos.pt</a>. Dados provisórios.
				{loadedTime && ` Atualizado às ${loadedTime}.`}
			</p>
		</section>
	)
}
