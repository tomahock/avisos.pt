import { useState } from 'react'

import { IPMA_AREAS } from '../../data/ipmaAreas.js'
import { eventAreaOccurrences, formatInstant, instant } from '../../utils/madeira.js'
import { relativeMinutes } from '../../utils/format.js'

const COMMUNIQUES = 3
const nf = new Intl.NumberFormat('pt-PT')

function Kpi({ label, value, hint }) {
	return (
		<div className="rounded-lg border border-gray-200 bg-surface px-3 py-2">
			<dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
			<dd className="m-0 mt-0.5 text-xl font-bold tabular-nums text-gray-900">{value}</dd>
			{hint && <dd className="m-0 text-[11px] text-gray-500">{hint}</dd>}
		</div>
	)
}

function Roads({ title, icon, iconClass, list }) {
	if (list.length === 0) return null
	return (
		<div>
			<h4 className="m-0 flex items-center gap-2 text-sm font-semibold text-gray-900">
				<i className={`fas ${icon} ${iconClass}`} aria-hidden />
				{title} <span className="font-normal text-gray-500">({list.length})</span>
			</h4>
			<ul className="mt-1 list-none m-0 p-0 space-y-1 text-sm text-gray-700">
				{list.map((r, i) => (
					<li key={`${r.road}-${i}`}>
						{r.road && <span className="font-semibold text-gray-900">{r.road}</span>}
						{r.road && r.text && ' — '}
						{r.text}
						{r.time && <span className="text-xs text-gray-500"> ({formatInstant(r.time)})</span>}
					</li>
				))}
			</ul>
		</div>
	)
}

// The adverse-weather event SRPC, IP-RAM has open for the region (one at a
// time, region-wide): period, numbers, roads, communiqués, advice.
export default function MadeiraEventPanel({ event, code }) {
	const [allCommuniques, setAllCommuniques] = useState(false)
	const start = formatInstant(event.start)
	const updated = instant(event.updatedAt)
	const inArea = eventAreaOccurrences(event, code)
	const { kpi } = event
	const closed = event.roadRestrictions.filter((r) => r.closed)
	const conditioned = event.roadRestrictions.filter((r) => !r.closed)
	const communiques = [...event.communiques].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
	const shownCommuniques = allCommuniques ? communiques : communiques.slice(0, COMMUNIQUES)
	const peakAt = kpi.peak ? instant(kpi.peak.time) : null

	return (
		<article aria-labelledby="madeira-evento" className="mt-3 rounded-xl border border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30 p-4">
			<p className="m-0 flex flex-wrap items-center gap-2 text-xs">
				<span className="rounded bg-amber-500 px-1.5 py-0.5 font-bold uppercase tracking-wide text-slate-900">Evento ativo</span>
				<span className="text-gray-600">Proteção Civil da Madeira{event.zone ? ` · ${event.zone}` : ''}</span>
			</p>
			<h3 id="madeira-evento" className="m-0 mt-2 text-base font-bold text-gray-900">{event.title ?? 'Situação meteorológica adversa'}</h3>
			<p className="m-0 mt-1 text-xs text-gray-600">
				{start && <>Desde {start}</>}
				{start && updated && ' · '}
				{updated && (
					<span title={updated.toLocaleString('pt-PT')}>
						atualizado {relativeMinutes(updated)} ({updated.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })})
					</span>
				)}
			</p>

			<dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 m-0">
				<Kpi label="Ocorrências" value={nf.format(kpi.occurrences)} hint="em toda a Região" />
				{inArea !== null && <Kpi label={code === 'MRM' ? 'Na ilha da Madeira' : `Em ${IPMA_AREAS[code].chip}`} value={nf.format(inArea)} hint="desde o início" />}
				<Kpi label="Em curso" value={nf.format(kpi.activeOccurrences)} />
				<Kpi label="Operacionais" value={nf.format(kpi.operationals)} hint={`${nf.format(kpi.groundAssets)} meios terrestres`} />
				{kpi.peak && peakAt && (
					<Kpi
						label="Pico"
						value={nf.format(kpi.peak.occurrences)}
						hint={`ocorrências às ${peakAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`}
					/>
				)}
			</dl>

			{event.summary && <p className="m-0 mt-3 text-sm text-gray-700">{event.summary}</p>}

			{(closed.length > 0 || conditioned.length > 0) && (
				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<Roads title="Estradas cortadas" icon="fa-ban" iconClass="text-red-600 dark:text-red-400" list={closed} />
					<Roads title="Estradas condicionadas" icon="fa-road" iconClass="text-amber-600 dark:text-amber-400" list={conditioned} />
				</div>
			)}

			{event.recommendations.length > 0 && (
				<div className="mt-4">
					<h4 className="m-0 text-sm font-semibold text-gray-900">Recomendações</h4>
					<ul className="mt-1 list-disc pl-5 m-0 space-y-0.5 text-sm text-gray-700">
						{event.recommendations.map((r) => (
							<li key={r}>{r}</li>
						))}
					</ul>
				</div>
			)}

			{communiques.length > 0 && (
				<div className="mt-4">
					<h4 className="m-0 text-sm font-semibold text-gray-900">Comunicados</h4>
					<ul className="mt-1 list-none m-0 p-0 space-y-1 text-sm">
						{shownCommuniques.map((c, i) => (
							<li key={`${c.title}-${i}`} className="min-w-0">
								{c.link ? (
									<a href={c.link} target="_blank" rel="noreferrer" className="text-primary-700 break-words">
										{c.title}
									</a>
								) : (
									<span className="text-gray-900 break-words">{c.title}</span>
								)}
								{c.time && <span className="text-xs text-gray-500"> · {formatInstant(c.time)}</span>}
							</li>
						))}
					</ul>
					{communiques.length > COMMUNIQUES && (
						<button type="button" onClick={() => setAllCommuniques((v) => !v)} className="mt-1 text-sm font-medium text-primary-700">
							{allCommuniques ? 'Mostrar menos' : `Ver os ${communiques.length} comunicados`}
						</button>
					)}
				</div>
			)}

			{event.notes && <p className="m-0 mt-3 text-xs text-gray-500">{event.notes}</p>}
		</article>
	)
}
