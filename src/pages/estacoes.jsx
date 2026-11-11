import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import { IPMA_AREAS } from '../data/ipmaAreas.js'
import { useMediaQuery } from '../hooks/useMediaQuery.js'
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

// Sortable columns. `dir` is the default direction when picked. The station
// name ('nome', A→Z) is the default sort and isn't written in the URL.
const DEFAULT_SORT = 'nome'
const NAME_SORT = { key: 'nome', label: 'Estação', dir: 'asc' }
// `get(row)` → number|null (sorting and display); `partial(row)` → hours of
// today without a reading (the value is then a bound: ≥ for max/total, ≤ for
// min). The "since 00:00" columns come from /api/observations `today` (#48).
const latest = (key) => (r) => reading(r.obs, key)
const today = (key) => (r) => r.today?.[key] ?? null
const TODAY_NOTE = 'desde as 00h (hora local da estação)'
const COLUMNS = [
	{ key: 'temperatura', label: 'Temp.', fmt: fmtTemp, dir: 'desc', get: latest('temperatura') },
	{ key: 'tmax', label: 'Máx.', fmt: fmtTemp, dir: 'desc', get: today('tmax'), partial: today('tMissing'), bound: '≥', title: `Temperatura máxima ${TODAY_NOTE}` },
	{ key: 'tmin', label: 'Mín.', fmt: fmtTemp, dir: 'asc', get: today('tmin'), partial: today('tMissing'), bound: '≤', title: `Temperatura mínima ${TODAY_NOTE}` },
	{ key: 'intensidadeVentoKM', label: 'Vento', fmt: fmtKmh, dir: 'desc', get: latest('intensidadeVentoKM') },
	{ key: 'ventoMax', label: 'Vento máx.', fmt: fmtKmh, dir: 'desc', get: today('windMax'), partial: today('wMissing'), bound: '≥', title: 'Maior vento médio horário desde as 00h — o IPMA não publica a rajada em tempo real' },
	{ key: 'precAcumulada', label: 'Chuva 1 h', fmt: fmtMm, dir: 'desc', get: latest('precAcumulada') },
	{ key: 'chuvaHoje', label: 'Chuva desde 0h', fmt: fmtMm, dir: 'desc', get: today('rain'), partial: today('rMissing'), bound: '≥', title: `Chuva acumulada ${TODAY_NOTE}` },
	{ key: 'humidade', label: 'Humidade', fmt: fmtPct, dir: 'desc', get: latest('humidade') },
	{ key: 'pressao', label: 'Pressão', fmt: fmtHpa, dir: 'asc', get: latest('pressao') },
]

// pt-PT collation, accents and case ignored ("Évora" between "Bragança" and "Funchal").
const byName = (a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' })

function normalize(s) {
	return String(s)
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
}

// `value(row)` → the text of the big number (default: the latest reading).
function Highlight({ label, row, field, fmt, value, className = '' }) {
	if (!row) return null
	return (
		<Link
			to={stationPath(row.id, row.name)}
			className={`block rounded-xl border border-gray-200 bg-surface px-4 py-3 no-underline hover:border-gray-300 hover:bg-gray-50 ${className}`}
		>
			<p className="text-xs text-gray-500">{label}</p>
			<p className="mt-0.5 text-2xl font-semibold text-gray-900 tabular-nums">{value ? value(row) : fmt(reading(row.obs, field))}</p>
			<p className="text-sm text-gray-700 truncate">{row.name}</p>
		</Link>
	)
}

// Ties go to the first name A→Z — the same tie-break as the sorted list, so
// a tile and the top row of that column always name the same station.
// `field` = an observation field, or a getter (row) => number|null.
function extreme(rows, field, pick) {
	const get = typeof field === 'function' ? field : (r) => reading(r.obs, field)
	let best = null
	for (const r of rows) {
		const v = get(r)
		if (v == null) continue
		const bv = best ? get(best) : null
		if (!best || pick(v, bv) || (v === bv && byName(r, best) < 0)) best = r
	}
	return best
}

function WindValue({ obs }) {
	const v = reading(obs, 'intensidadeVentoKM')
	const dir = v != null ? windDir(reading(obs, 'idDireccVento')) : null
	return (
		<>
			{fmtKmh(v) ?? <span className="text-gray-300">—</span>}
			{dir && <span className="text-gray-400 font-normal"> {dir}</span>}
		</>
	)
}

function cellValue(c, r) {
	if (c.key === 'intensidadeVentoKM') return <WindValue obs={r.obs} />
	const v = c.get(r)
	if (v == null) return <span className="text-gray-300">—</span>
	const missing = c.partial?.(r) ?? 0
	if (!missing) return c.fmt(v)
	return (
		<span title={`${missing} h sem leitura desde as 00h`}>
			{c.bound} {c.fmt(v)}
		</span>
	)
}

function SortIcon({ active, dir }) {
	return <i className={`fas ${active ? (dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort opacity-40'} text-[10px]`} aria-hidden />
}

// Wider screens: a table; the name column stays put when the table scrolls
// sideways. Tighter cell padding below 1280 px so it fits at 1024 px with any
// font metrics (CI's Linux fonts overflowed by 1 px with px-3). Stacking: header corner (z-20, opaque) above the body name cells
// (z-10) so a name can never paint over the header (#46).
function StationTable({ rows, sortKey, sortDir, onSort }) {
	const ariaSort = (key) => (sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none')
	return (
		<div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
			<table className="w-full text-sm tabular-nums">
				<thead className="bg-gray-50 text-xs text-gray-500">
					<tr>
						<th className="sticky left-0 z-20 bg-gray-50 text-left font-semibold px-2 xl:px-3 py-2" aria-sort={ariaSort('nome')}>
							<button type="button" onClick={() => onSort('nome')} className={`inline-flex items-center gap-1 ${sortKey === 'nome' ? 'text-gray-900' : 'hover:text-gray-900'}`}>
								Estação
								<SortIcon active={sortKey === 'nome'} dir={sortDir} />
							</button>
						</th>
						<th className="hidden xl:table-cell text-left font-semibold px-2 xl:px-3 py-2">Distrito / região</th>
						{COLUMNS.map((c) => (
							<th key={c.key} className="text-right font-semibold px-2 xl:px-3 py-2 whitespace-nowrap" aria-sort={ariaSort(c.key)} title={c.title}>
								<button type="button" onClick={() => onSort(c.key)} className={`inline-flex items-center gap-1 ${sortKey === c.key ? 'text-gray-900' : 'hover:text-gray-900'}`}>
									{c.label}
									<SortIcon active={sortKey === c.key} dir={sortDir} />
								</button>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
							<td className="sticky left-0 z-10 bg-surface px-2 xl:px-3 py-1.5 font-medium">
								<Link to={stationPath(r.id, r.name)} className="block text-gray-900 no-underline hover:underline leading-tight">
									{r.name}
								</Link>
								{/* Below 1280 px the district column is hidden; it moves under the name. */}
								{r.area && (
									<span data-district className="xl:hidden block text-[11px] font-normal leading-tight text-gray-500">
										{IPMA_AREAS[r.area]?.name}
									</span>
								)}
							</td>
							<td className="hidden xl:table-cell px-2 xl:px-3 py-1.5 text-gray-600 whitespace-nowrap">
								{r.area ? (
									<Link to={districtPath(r.area)} className="text-gray-600 no-underline hover:underline">
										{IPMA_AREAS[r.area]?.name}
									</Link>
								) : (
									'—'
								)}
							</td>
							{COLUMNS.map((c) => (
								<td key={c.key} className={`px-2 xl:px-3 py-1.5 text-right whitespace-nowrap ${sortKey === c.key ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>
									{cellValue(c, r)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

// Phones: today's extremes under the district ("Hoje 8,0–16,0 °C · 3,2 mm"),
// without the value that is already the big number on the right (sorting by
// Máx. → "Hoje mín. 8,0 °C · 3,2 mm"); no line when nothing is left.
function TodayLine({ r, sortKey }) {
	const t = r.today
	if (!t) return null
	const parts = []
	const tb = (bound) => (t.tMissing ? `${bound} ` : '')
	if (t.tmax != null) {
		if (sortKey === 'tmax') parts.push(`mín. ${tb('≤')}${fmtTemp(t.tmin)}`)
		else if (sortKey === 'tmin') parts.push(`máx. ${tb('≥')}${fmtTemp(t.tmax)}`)
		else parts.push(`${t.tMissing ? '≈ ' : ''}${fmtTemp(t.tmin)}–${fmtTemp(t.tmax)}`)
	}
	if (t.rain != null && sortKey !== 'chuvaHoje') parts.push(`${t.rMissing ? '≥ ' : ''}${fmtMm(t.rain)}`)
	if (parts.length === 0) return null
	return (
		<span data-today className="block text-[11px] leading-tight text-gray-500">
			Hoje {parts.join(' · ')}
		</span>
	)
}

// Phones: one list item per station — name and readings in the same box, so
// they can't drift apart (the old sticky table cells were painted out of step
// with their rows by some mobile browsers, #46). The sorted measure is the
// big value (temperature when sorting by name); the others go underneath.
const PHONE_SECONDARY = ['temperatura', 'intensidadeVentoKM', 'precAcumulada']

function StationList({ rows, sortKey, sortDir, sorts, onSort }) {
	const primary = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[0]
	const secondary = COLUMNS.filter((c) => PHONE_SECONDARY.includes(c.key) && c.key !== primary.key)
	const asc = sortDir === 'asc'
	return (
		<>
			<div className="mt-4 flex items-center gap-2 text-sm">
				<label className="flex items-center gap-2 text-gray-600">
					Ordenar por
					<select
						value={sortKey}
						onChange={(e) => onSort(e.target.value, sorts.find((c) => c.key === e.target.value).dir)}
						className="rounded-md border border-gray-200 bg-surface px-2 py-1.5 text-sm text-gray-900"
					>
						{sorts.map((c) => (
							<option key={c.key} value={c.key}>
								{c.key === 'nome' ? 'Nome' : c.label}
							</option>
						))}
					</select>
				</label>
				<button
					type="button"
					onClick={() => onSort(sortKey)}
					aria-label={`Ordem: ${asc ? 'ascendente' : 'descendente'} (mudar)`}
					className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-surface px-2 py-1.5 text-gray-700"
				>
					<i className={`fas ${asc ? 'fa-arrow-up' : 'fa-arrow-down'} text-xs`} aria-hidden />
					{sortKey === 'nome' ? (asc ? 'A–Z' : 'Z–A') : asc ? 'menor' : 'maior'}
				</button>
			</div>
			<ul aria-label="Estações" className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-surface list-none m-0 p-0 tabular-nums">
				{rows.map((r) => (
					<li key={r.id} data-station-id={r.id}>
						<Link to={stationPath(r.id, r.name)} className="flex items-start gap-3 px-3 py-2 no-underline hover:bg-gray-50">
							<span className="min-w-0 flex-1">
								<span data-station-name className="block text-sm font-medium leading-tight text-gray-900">{r.name}</span>
								<span className="block text-[11px] leading-tight text-gray-500">{IPMA_AREAS[r.area]?.name ?? '—'}</span>
								<TodayLine r={r} sortKey={sortKey} />
							</span>
							<span className="shrink-0 text-right">
								<span data-primary className="block text-base font-semibold leading-tight text-gray-900 whitespace-nowrap">
									{cellValue(primary, r)}
								</span>
								<span className="block text-[11px] leading-tight text-gray-500 whitespace-nowrap">
									{secondary.map((c, i) => (
										<span key={c.key}>
											{i > 0 && ' · '}
											{cellValue(c, r)}
										</span>
									))}
								</span>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</>
	)
}

export default function EstacoesPage() {
	usePageTitle(`${PAGE_META['/estacoes'].title} · Avisos.pt`, { description: PAGE_META['/estacoes'].description })

	const { stations, stationsStatus, obs, obsHour, today: todayById, warnings, updatedAt, retry } = useWarningsData()
	const [params, setParams] = useSearchParams()
	const region = params.get('regiao') ?? ''
	const sorts = [NAME_SORT, ...COLUMNS]
	const sortKey = sorts.some((c) => c.key === params.get('ordem')) ? params.get('ordem') : DEFAULT_SORT
	const sortCol = sorts.find((c) => c.key === sortKey)
	const sortDir = params.get('dir') === 'asc' || params.get('dir') === 'desc' ? params.get('dir') : sortCol.dir
	const q = params.get('q') ?? ''
	// Phones get a list (no sticky table cells, #46); wider screens the table.
	const narrow = useMediaQuery('(max-width: 639px)')

	function update(next) {
		const merged = { regiao: region, ordem: sortKey === DEFAULT_SORT ? '' : sortKey, dir: params.get('dir') ?? '', q, ...next }
		setParams(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)), { replace: true })
	}

	// Same column → flip direction; another → its default direction. The
	// default direction of a column is never written (?dir= only when flipped).
	function sortBy(key, dir) {
		const col = sorts.find((c) => c.key === key)
		const d = dir ?? (key === sortKey ? (sortDir === 'desc' ? 'asc' : 'desc') : col.dir)
		update({ ordem: key === DEFAULT_SORT ? '' : key, dir: d === col.dir ? '' : d })
	}

	const rows = useMemo(
		() => stationRows(stations, obs).map((r) => ({ ...r, today: todayById?.[String(r.id)] ?? null })),
		[stations, obs, todayById]
	)
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
		if (sortKey === 'nome') return [...list].sort((a, b) => byName(a, b) * sign)
		const get = sortCol.get
		return [...list].sort((a, b) => {
			const va = get(a)
			const vb = get(b)
			if (va == null && vb == null) return byName(a, b)
			if (va == null) return 1 // no reading → always last
			if (vb == null) return -1
			return (va - vb) * sign || byName(a, b)
		})
	}, [inRegion, q, sortKey, sortDir, sortCol])

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

				<section className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
					<Highlight label="Mais quente agora" row={extreme(withObs, 'temperatura', (a, b) => a > b)} field="temperatura" fmt={fmtTemp} />
					<Highlight label="Mais fria agora" row={extreme(withObs, 'temperatura', (a, b) => a < b)} field="temperatura" fmt={fmtTemp} />
					<Highlight label="Vento mais forte" row={extreme(withObs, 'intensidadeVentoKM', (a, b) => a > b)} field="intensidadeVentoKM" fmt={fmtKmh} />
					<Highlight label="Mais chuva na última hora" row={extreme(withObs, 'precAcumulada', (a, b) => a > b)} field="precAcumulada" fmt={fmtMm} />
					<Highlight
						label="Mais chuva hoje"
						// 5th tile: full width on phones instead of a lone half cell.
						className="col-span-2 sm:col-span-1"
						row={extreme(inRegion, (r) => r.today?.rain ?? null, (a, b) => a > b)}
						value={(r) => `${r.today.rMissing ? '≥ ' : ''}${fmtMm(r.today.rain)}`}
					/>
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

				{narrow ? (
					<StationList rows={visible} sortKey={sortKey} sortDir={sortDir} sorts={sorts} onSort={sortBy} />
				) : (
					<StationTable rows={visible} sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
				)}
				{visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-500">Nenhuma estação corresponde à pesquisa.</p>}
				<p className="mt-3 text-xs text-gray-500">
					Fonte: IPMA, via API Fogos.pt. Vento = velocidade média na hora (não rajada). «Máx.», «Mín.», «Vento máx.» e «Chuva desde 0h» contam desde as
					00h (hora local da estação; nos Açores, hora dos Açores); com horas sem leitura o valor é um limite (≥ / ≤). «Vento máx.» é o maior vento médio
					horário desde as 00h — o IPMA não publica a rajada em tempo real. Ao ordenar por um valor, as estações sem leitura aparecem no fim.
				</p>
			</div>
		</Layout>
	)
}
