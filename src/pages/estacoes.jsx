import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import { IPMA_AREAS } from '../data/ipmaAreas.js'
import { useWarningsData } from '../hooks/useWarningsData.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { PAGE_META, districtPath } from '../utils/share.js'
import { fmtHpa, fmtKmh, fmtMm, fmtPct, fmtTemp, obsDate, reading, stationPath, stationRows, windDir } from '../utils/stations.js'

const REGIONS = [
	{ key: '', label: 'Todas' },
	{ key: 'continental', label: 'Continente' },
	{ key: 'acores', label: 'Açores' },
	{ key: 'madeira', label: 'Madeira' },
]

// Sortable columns. `dir` is the default direction when picked.
const COLUMNS = [
	{ key: 'temperatura', label: 'Temp.', fmt: fmtTemp, dir: 'desc' },
	{ key: 'intensidadeVentoKM', label: 'Vento', fmt: fmtKmh, dir: 'desc' },
	{ key: 'precAcumulada', label: 'Chuva 1 h', fmt: fmtMm, dir: 'desc' },
	{ key: 'humidade', label: 'Humidade', fmt: fmtPct, dir: 'desc' },
	{ key: 'pressao', label: 'Pressão', fmt: fmtHpa, dir: 'asc' },
]

function normalize(s) {
	return String(s)
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
}

function Highlight({ label, row, field, fmt }) {
	if (!row) return null
	return (
		<Link
			to={stationPath(row.id, row.name)}
			className="block rounded-xl border border-gray-200 bg-surface px-4 py-3 no-underline hover:border-gray-300 hover:bg-gray-50"
		>
			<p className="text-xs text-gray-500">{label}</p>
			<p className="mt-0.5 text-2xl font-semibold text-gray-900 tabular-nums">{fmt(reading(row.obs, field))}</p>
			<p className="text-sm text-gray-700 truncate">{row.name}</p>
		</Link>
	)
}

function extreme(rows, field, pick) {
	let best = null
	for (const r of rows) {
		const v = reading(r.obs, field)
		if (v == null) continue
		if (!best || pick(v, reading(best.obs, field))) best = r
	}
	return best
}

export default function EstacoesPage() {
	usePageTitle(`${PAGE_META['/estacoes'].title} · Avisos.pt`, { description: PAGE_META['/estacoes'].description })

	const { stations, stationsStatus, obs, obsHour, warnings, updatedAt, retry } = useWarningsData()
	const [params, setParams] = useSearchParams()
	const region = params.get('regiao') ?? ''
	const sortKey = COLUMNS.some((c) => c.key === params.get('ordem')) ? params.get('ordem') : 'temperatura'
	const sortDir = params.get('dir') === 'asc' || params.get('dir') === 'desc' ? params.get('dir') : COLUMNS.find((c) => c.key === sortKey).dir
	const q = params.get('q') ?? ''

	function update(next) {
		const merged = { regiao: region, ordem: sortKey === 'temperatura' ? '' : sortKey, dir: params.get('dir') ?? '', q, ...next }
		setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)), { replace: true })
	}

	function sortBy(key) {
		const col = COLUMNS.find((c) => c.key === key)
		const dir = key === sortKey ? (sortDir === 'desc' ? 'asc' : 'desc') : col.dir
		update({ ordem: key === 'temperatura' ? '' : key, dir: dir === col.dir ? '' : dir })
	}

	const rows = useMemo(() => stationRows(stations, obs), [stations, obs])
	const inRegion = useMemo(
		() => rows.filter((r) => !region || IPMA_AREAS[r.area]?.region === region),
		[rows, region]
	)
	const visible = useMemo(() => {
		const needle = normalize(q.trim())
		const list = needle
			? inRegion.filter((r) => normalize(`${r.name} ${IPMA_AREAS[r.area]?.name ?? ''}`).includes(needle))
			: inRegion
		const sign = sortDir === 'asc' ? 1 : -1
		return [...list].sort((a, b) => {
			const va = reading(a.obs, sortKey)
			const vb = reading(b.obs, sortKey)
			if (va == null && vb == null) return a.name.localeCompare(b.name, 'pt')
			if (va == null) return 1 // no reading → always last
			if (vb == null) return -1
			return (va - vb) * sign || a.name.localeCompare(b.name, 'pt')
		})
	}, [inRegion, q, sortKey, sortDir])

	if (stationsStatus === 'error') {
		return (
			<Layout>
				<StateError title="Não foi possível carregar as estações" message="A lista de estações meteorológicas não está disponível de momento." onRetry={retry} />
			</Layout>
		)
	}
	if (stationsStatus === 'loading') {
		return (
			<Layout>
				<StateLoading />
			</Layout>
		)
	}

	const withObs = inRegion.filter((r) => r.obs)
	const when = obsDate(obsHour)
	const regionChip = (key) =>
		`px-3 py-1 rounded-md text-xs font-semibold transition ${region === key ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`

	return (
		<Layout updatedAt={updatedAt ?? (warnings ? new Date() : null)}>
			<div className="px-4 mt-6">
				<header>
					<h1 className="text-2xl font-bold text-gray-900 tracking-tight">Estações meteorológicas IPMA</h1>
					<p className="mt-1 text-sm text-gray-500">
						{withObs.length} de {inRegion.length} estações com leitura
						{when ? ` às ${when.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} (hora local)` : ''}.
					</p>
				</header>

				<section className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
					<Highlight label="Mais quente agora" row={extreme(withObs, 'temperatura', (a, b) => a > b)} field="temperatura" fmt={fmtTemp} />
					<Highlight label="Mais fria agora" row={extreme(withObs, 'temperatura', (a, b) => a < b)} field="temperatura" fmt={fmtTemp} />
					<Highlight label="Vento mais forte" row={extreme(withObs, 'intensidadeVentoKM', (a, b) => a > b)} field="intensidadeVentoKM" fmt={fmtKmh} />
					<Highlight label="Mais chuva na última hora" row={extreme(withObs, 'precAcumulada', (a, b) => a > b)} field="precAcumulada" fmt={fmtMm} />
				</section>

				<div className="mt-6 flex flex-wrap items-center gap-3">
					<div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Região">
						{REGIONS.map((r) => (
							<button key={r.key} type="button" role="tab" aria-selected={region === r.key} onClick={() => update({ regiao: r.key })} className={regionChip(r.key)}>
								{r.label}
							</button>
						))}
					</div>
					<label className="relative flex-1 min-w-[12rem] max-w-sm">
						<span className="sr-only">Procurar estação ou distrito</span>
						<i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" aria-hidden />
						<input
							type="search"
							value={q}
							onChange={(e) => update({ q: e.target.value })}
							placeholder="Procurar estação ou distrito"
							className="w-full rounded-lg border border-gray-200 bg-surface pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
						/>
					</label>
				</div>

				<div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
					<table className="w-full text-sm tabular-nums">
						<thead className="bg-gray-50 text-xs text-gray-500">
							<tr>
								<th className="sticky left-0 z-10 bg-gray-50 text-left font-semibold px-3 py-2">Estação</th>
								<th className="hidden sm:table-cell text-left font-semibold px-3 py-2">Distrito / região</th>
								{COLUMNS.map((c) => (
									<th key={c.key} className="text-right font-semibold px-3 py-2" aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type="button" onClick={() => sortBy(c.key)} className={`inline-flex items-center gap-1 ${sortKey === c.key ? 'text-gray-900' : 'hover:text-gray-900'}`}>
											{c.label}
											<i className={`fas ${sortKey === c.key ? (sortDir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort opacity-40'} text-[10px]`} aria-hidden />
										</button>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{visible.map((r) => (
								<tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
									<td className="sticky left-0 z-10 bg-surface px-3 py-1.5 font-medium max-w-[9.5rem] sm:max-w-none">
										<Link to={stationPath(r.id, r.name)} className="block text-gray-900 no-underline hover:underline leading-tight">
											{r.name}
										</Link>
										{/* District moves under the name on phones so the values fit on screen. */}
										{r.area && <span className="sm:hidden block text-[11px] font-normal text-gray-500 leading-tight">{IPMA_AREAS[r.area]?.name}</span>}
									</td>
									<td className="hidden sm:table-cell px-3 py-1.5 text-gray-600 whitespace-nowrap">
										{r.area ? (
											<Link to={districtPath(r.area)} className="text-gray-600 no-underline hover:underline">
												{IPMA_AREAS[r.area]?.name}
											</Link>
										) : (
											'—'
										)}
									</td>
									{COLUMNS.map((c) => (
										<td key={c.key} className={`px-3 py-1.5 text-right whitespace-nowrap ${sortKey === c.key ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>
											{c.fmt(reading(r.obs, c.key)) ?? <span className="text-gray-300">—</span>}
											{c.key === 'intensidadeVentoKM' && reading(r.obs, c.key) != null && windDir(reading(r.obs, 'idDireccVento')) && (
												<span className="text-gray-400 font-normal"> {windDir(reading(r.obs, 'idDireccVento'))}</span>
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
					{visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-500">Nenhuma estação corresponde à pesquisa.</p>}
				</div>
				<p className="mt-3 text-xs text-gray-500">
					Fonte: IPMA, via API Fogos.pt. Vento = velocidade média na hora (não rajada). Estações sem leitura aparecem no fim.
				</p>
			</div>
		</Layout>
	)
}
