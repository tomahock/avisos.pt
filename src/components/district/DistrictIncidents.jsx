import { useEffect, useMemo, useState } from 'react'

import { IPMA_AREAS } from '../../data/ipmaAreas.js'
import { fetchJson } from '../../utils/fetchJson.js'
import { relativeMinutes } from '../../utils/format.js'
import { districtIncidents, incidentKind, incidentUrl } from '../../utils/incidents.js'

const REFRESH_MS = 2 * 60 * 1000
// Past this age a snapshot is too old to show as "em curso" at all.
const MAX_STALE_MS = 15 * 60 * 1000
const COLLAPSED = 8

// ANEPC status colours come as hex without '#'; pick readable text for them.
function statusStyle(hex) {
	const h = /^[0-9a-f]{6}$/i.test(hex ?? '') ? hex : '94A3B8'
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
	const light = 0.299 * r + 0.587 * g + 0.114 * b > 160
	return { backgroundColor: `#${h}`, color: light ? '#0f172a' : '#ffffff' }
}

function plural(n, one, many) {
	return `${n} ${n === 1 ? one : many}`
}

function Means({ i }) {
	const parts = [
		i.man > 0 && plural(i.man, 'operacional', 'operacionais'),
		i.terrain > 0 && plural(i.terrain, 'veículo', 'veículos'),
		i.aerial > 0 && plural(i.aerial, 'meio aéreo', 'meios aéreos'),
		i.aquatic > 0 && plural(i.aquatic, 'meio aquático', 'meios aquáticos'),
	].filter(Boolean)
	if (parts.length === 0) return null
	return <span>{parts.join(' · ')}</span>
}

// Active ANEPC incidents caused by adverse weather (FMA) in one district,
// from the FogosPT API. Continental districts only (ANEPC's area).
export default function DistrictIncidents({ code }) {
	const [all, setAll] = useState(null)
	const [failed, setFailed] = useState(false)
	const [loadedAt, setLoadedAt] = useState(null)
	// Re-render on a clock so a snapshot that stopped refreshing ages out.
	const [, setTick] = useState(0)
	const [expanded, setExpanded] = useState(false)
	const continental = IPMA_AREAS[code]?.region === 'continental'

	useEffect(() => {
		if (!continental) return
		let ctrl
		const load = () => {
			ctrl?.abort()
			ctrl = new AbortController()
			fetchJson('/api/incidents/fma', ctrl.signal)
				.then((data) => {
					setAll(Array.isArray(data) ? data : [])
					setLoadedAt(new Date())
					setFailed(false)
				})
				.catch((err) => {
					if (err.name !== 'AbortError') setFailed(true)
				})
		}
		load()
		const id = setInterval(() => {
			load()
			setTick((t) => t + 1)
		}, REFRESH_MS)
		return () => {
			clearInterval(id)
			ctrl?.abort()
		}
	}, [continental])

	useEffect(() => setExpanded(false), [code])

	const list = useMemo(
		() =>
			districtIncidents(all, code).sort((a, b) => (b.start ?? '').localeCompare(a.start ?? '')),
		[all, code]
	)
	const kinds = useMemo(() => {
		const m = new Map()
		for (const i of list) {
			const k = incidentKind(i.natureza)
			m.set(k.label, { ...k, n: (m.get(k.label)?.n ?? 0) + 1 })
		}
		return [...m.values()].sort((a, b) => b.n - a.n)
	}, [list])

	if (!continental) return null
	// Never loaded, or the last good snapshot is too old: hide the section
	// (a FogosPT outage must not show stale incidents as "em curso").
	if (all === null || !loadedAt) return null
	const stale = failed
	if (stale && Date.now() - loadedAt.getTime() > MAX_STALE_MS) return null
	const loadedTime = loadedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

	const name = IPMA_AREAS[code].name
	const shown = expanded ? list : list.slice(0, COLLAPSED)

	return (
		<section className="mt-10">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-lg font-bold text-gray-900">Ocorrências por fenómenos meteorológicos</h2>
				<span className="text-xs text-gray-500">Proteção civil (ANEPC), em curso</span>
			</div>

			{stale && (
				<p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
					<i className="fas fa-triangle-exclamation" aria-hidden />
					Não foi possível atualizar as ocorrências — dados das {loadedTime}.
				</p>
			)}

			{list.length === 0 && stale ? null : list.length === 0 ? (
				<p className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
					<i className="fas fa-check text-green-600" aria-hidden />
					Sem ocorrências de proteção civil por fenómenos meteorológicos em curso em {name}.
				</p>
			) : (
				<>
					<p className="mt-1 text-sm text-gray-600">
						{plural(list.length, 'ocorrência', 'ocorrências')} {stale ? `em curso às ${loadedTime}` : 'em curso'} em {name}
					</p>
					<ul className="mt-3 flex flex-wrap gap-2 list-none m-0 p-0">
						{kinds.map((k) => (
							<li key={k.label} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700">
								<i className={`fas ${k.icon} text-gray-500`} aria-hidden />
								{k.label}
								<span className="font-bold text-gray-900 tabular-nums">{k.n}</span>
							</li>
						))}
					</ul>

					<ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white list-none m-0 p-0">
						{shown.map((i) => {
							const kind = incidentKind(i.natureza)
							const where = [i.concelho, i.freguesia, i.localidade].filter(Boolean)
							const start = i.start ? new Date(i.start) : null
							return (
								<li key={i.id} className="flex gap-3 px-4 py-3">
									<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
										<i className={`fas ${kind.icon}`} aria-hidden />
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
											<span className="text-sm font-semibold text-gray-900">{i.natureza}</span>
											{i.status && (
												<span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={statusStyle(i.statusColor)}>
													{i.status}
												</span>
											)}
										</div>
										<p className="m-0 mt-0.5 truncate text-xs text-gray-600" title={where.join(' · ')}>
											{where.join(' · ')}
										</p>
										<p className="m-0 mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
											{start && (
												<span title={start.toLocaleString('pt-PT')}>
													{relativeMinutes(start)} ({start.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })})
												</span>
											)}
											<Means i={i} />
										</p>
									</div>
									<a
										href={incidentUrl(i.id)}
										target="_blank"
										rel="noreferrer"
										className="self-center shrink-0 text-xs font-semibold text-primary-700 no-underline hover:underline"
										aria-label={`Ver ${i.natureza} em ${i.concelho ?? name} no Fogos.pt`}
									>
										Fogos.pt →
									</a>
								</li>
							)
						})}
					</ul>
					{list.length > COLLAPSED && (
						<button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 text-sm font-medium text-primary-700">
							{expanded ? 'Mostrar menos' : `Ver todas as ${list.length} ocorrências`}
						</button>
					)}
				</>
			)}
			<p className="mt-2 text-xs text-gray-500">
				Fonte: ANEPC, via <a href="https://fogos.pt" target="_blank" rel="noreferrer" className="text-gray-600">Fogos.pt</a>. Atualizado às {loadedTime}.
			</p>
		</section>
	)
}
