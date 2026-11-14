import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import NotFound from '../components/layout/NotFound.jsx'
import Breadcrumb from '../components/district/Breadcrumb.jsx'
import ShareButtons from '../components/share/ShareButtons.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import StationChart from '../components/stations/StationChart.jsx'
import ThresholdsToggle from '../components/stations/ThresholdsToggle.jsx'
import { IPMA_AREAS } from '../data/ipmaAreas.js'
import { levelMeta, worstLevelId } from '../data/levels.js'
import { useShowThresholds } from '../hooks/useShowThresholds.js'
import { useStationDaily, useStationSeries } from '../hooks/useStationSeries.js'
import { chartSets } from '../utils/chartThresholds.js'
import { stationThresholds } from '../utils/criteriaThresholds.js'
import { rollingSum } from '../utils/rolling.js'
import { cumulativeRain, RAIN_PERIODS } from '../utils/rainCumulative.js'
import { stationTimeZone } from '../utils/stationToday.js'
import { useWarningsData } from '../hooks/useWarningsData.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { areaWarnings, districtPath, warningHeadline } from '../utils/share.js'
import {
	fmtHpa,
	fmtKmh,
	fmtMm,
	fmtPct,
	fmtTemp,
	haversineKm,
	obsDate,
	reading,
	stationIdFromSlug,
	stationPath,
	stationRows,
	stationSeo,
	windDir,
} from '../utils/stations.js'

const RANGES = [
	{ hours: 24, label: '24 h' },
	{ hours: 48, label: '48 h' },
	{ hours: 72, label: '3 dias' },
	{ hours: 168, label: '7 dias' },
]

const timeFmt = (t) => t.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
const dayHourFmt = (t) =>
	t.toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// X labels for hourly charts: day name at local midnight, otherwise every
// 6 h (every 12/24 h on the longer ranges so labels don't collide).
function hourlyXLabel(hours) {
	const every = hours <= 48 ? 6 : hours <= 72 ? 12 : 24
	return (p) => {
		const h = p.t.getHours()
		if (h === 0) return p.t.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' }).replace('.', '')
		if (every < 24 && h % every === 0) return String(h).padStart(2, '0')
		return null
	}
}

function Tile({ label, value, sub, hero = false }) {
	return (
		<div className="rounded-xl border border-gray-200 bg-surface px-4 py-3">
			<p className="text-xs text-gray-500">{label}</p>
			<p className={`mt-0.5 font-semibold text-gray-900 tabular-nums ${hero ? 'text-4xl' : 'text-2xl'}`}>
				{value ?? <span className="text-gray-300">—</span>}
			</p>
			{sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
		</div>
	)
}

function Summary({ points }) {
	const temps = points.filter((p) => p.temperatura != null)
	if (temps.length === 0) return null
	const max = temps.reduce((a, p) => (p.temperatura > a.temperatura ? p : a))
	const min = temps.reduce((a, p) => (p.temperatura < a.temperatura ? p : a))
	// Missing rain readings are not zero: hide the total when nothing was
	// measured and flag it when some hours are missing.
	const rainPts = points.filter((p) => p.precAcumulada != null)
	const rain = rainPts.reduce((s, p) => s + p.precAcumulada, 0)
	const rainMissing = points.length - rainPts.length
	const wind = points.filter((p) => p.intensidadeVentoKM != null)
	const windMax = wind.length ? wind.reduce((a, p) => (p.intensidadeVentoKM > a.intensidadeVentoKM ? p : a)) : null
	return (
		<p className="text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
			<span>
				Máx. <strong className="text-gray-900 tabular-nums">{fmtTemp(max.temperatura)}</strong> {dayHourFmt(max.t)}
			</span>
			<span>
				Mín. <strong className="text-gray-900 tabular-nums">{fmtTemp(min.temperatura)}</strong> {dayHourFmt(min.t)}
			</span>
			{rainPts.length > 0 && (
				<span>
					Chuva acumulada <strong className="text-gray-900 tabular-nums">{rainMissing > 0 ? '≥ ' : ''}{fmtMm(rain)}</strong>
					{rainMissing > 0 && (
						<span className="text-gray-500"> ({rainMissing} h sem dados)</span>
					)}
				</span>
			)}
			{windMax && (
				<span>
					Vento médio máx. <strong className="text-gray-900 tabular-nums">{fmtKmh(windMax.intensidadeVentoKM)}</strong>
				</span>
			)}
		</p>
	)
}

function HourlyTable({ points }) {
	return (
		<details className="mt-4">
			<summary className="cursor-pointer text-sm font-medium text-primary-700 select-none">Ver tabela</summary>
			<div className="mt-2 max-h-80 overflow-auto rounded-lg border border-gray-200">
				<table className="w-full text-sm tabular-nums">
					<thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
						<tr>
							<th className="text-left font-semibold px-3 py-2">Hora</th>
							<th className="text-right font-semibold px-3 py-2">Temp.</th>
							<th className="text-right font-semibold px-3 py-2">Chuva</th>
							<th className="text-right font-semibold px-3 py-2">Vento</th>
							<th className="text-right font-semibold px-3 py-2">Humidade</th>
							<th className="text-right font-semibold px-3 py-2">Pressão</th>
						</tr>
					</thead>
					<tbody>
						{[...points].reverse().map((p) => (
							<tr key={p.t.getTime()} className="border-t border-gray-100">
								<td className="px-3 py-1.5 text-gray-700">{dayHourFmt(p.t)}</td>
								<td className="px-3 py-1.5 text-right">{fmtTemp(p.temperatura) ?? '—'}</td>
								<td className="px-3 py-1.5 text-right">{fmtMm(p.precAcumulada) ?? '—'}</td>
								<td className="px-3 py-1.5 text-right">
									{fmtKmh(p.intensidadeVentoKM) ?? '—'} {windDir(p.idDireccVento) ?? ''}
								</td>
								<td className="px-3 py-1.5 text-right">{fmtPct(p.humidade) ?? '—'}</td>
								<td className="px-3 py-1.5 text-right">{fmtHpa(p.pressao) ?? '—'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	)
}

const WIND_NOTE_REGION = { continente: 'continente', madeira: 'madeira', acores: 'acores' }

// Under the wind chart: the gust lines are only a reference.
function WindNote({ region }) {
	return (
		<>
			Os avisos de vento usam a rajada máxima; as estações só reportam o vento médio — as linhas de rajada são referência
			{region === 'acores' ? ' (as de vento médio comparam diretamente)' : ''}. Nas terras altas os limiares são mais altos —{' '}
			<Link to={`/criterios?regiao=${WIND_NOTE_REGION[region]}`} className="text-primary-700">
				ver critérios
			</Link>
			.
		</>
	)
}

function HourlySection({ id, sets, region }) {
	const [hours, setHours] = useState(48)
	const [hoverIdx, setHoverIdx] = useState(null)
	const { points, limited } = useStationSeries(id, hours)
	const shown = limited ? 24 : hours
	const xLabel = useMemo(() => hourlyXLabel(shown), [shown])

	const series = (field) => (points ?? []).map((p) => ({ t: p.t, v: p[field] }))
	// 6 h rolling rain, compared with the mm/6h criterion (only with criteria).
	const rain6h = useMemo(() => rollingSum((points ?? []).map((p) => p.precAcumulada), 6), [points])
	const extra = {
		temperatura: { thresholds: sets.temperatura, note: sets.temperatura.length ? 'Os avisos de Tempo Quente/Frio exigem ≥ 48 h.' : null },
		precAcumulada: {
			thresholds: sets.chuva,
			overlay: sets.chuva.length ? { values: rain6h, label: '6 h', format: fmtMm } : null,
			note: sets.chuva.length ? 'Linha tracejada verde: chuva das últimas 6 h, comparada com os limiares «6 h»; barras: chuva em cada hora.' : null,
		},
		intensidadeVentoKM: { thresholds: sets.vento, note: sets.vento.length ? <WindNote region={region} /> : null },
	}

	return (
		<section className="mt-8">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-bold text-gray-900">Hora a hora</h2>
					<p className="text-xs text-gray-500">Últimas {limited ? '24 horas' : RANGES.find((r) => r.hours === hours)?.label}, hora local</p>
				</div>
				{!limited && (
					<div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Período">
						{RANGES.map((r) => (
							<button
								key={r.hours}
								type="button"
								role="tab"
								aria-selected={hours === r.hours}
								onClick={() => setHours(r.hours)}
								className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
									hours === r.hours ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
								}`}
							>
								{r.label}
							</button>
						))}
					</div>
				)}
			</div>

			{points === null ? (
				<p className="mt-6 text-sm text-gray-500">A carregar…</p>
			) : points.length === 0 ? (
				<p className="mt-6 text-sm text-gray-500">Sem observações disponíveis para esta estação.</p>
			) : (
				<>
					<div className="mt-3">
						<Summary points={points} />
					</div>
					<div className="mt-4 grid gap-6 lg:grid-cols-2">
						{[
							['Temperatura', 'temperatura', 'line', fmtTemp, 'minmax'],
							['Precipitação por hora', 'precAcumulada', 'bar', fmtMm, 'total'],
							['Vento médio', 'intensidadeVentoKM', 'line', fmtKmh, 'max'],
							['Humidade relativa', 'humidade', 'line', fmtPct, 'minmax'],
						].map(([title, field, kind, format, stats]) => (
							<StationChart
								key={field}
								title={title}
								kind={kind}
								points={series(field)}
								format={format}
								stats={stats}
								formatTime={dayHourFmt}
								xLabel={xLabel}
								hoverIdx={hoverIdx}
								onHover={setHoverIdx}
								{...extra[field]}
							/>
						))}
					</div>
					<HourlyTable points={points} />
				</>
			)}
		</section>
	)
}

// Rain accumulated since local 00:00 (#58): its own period picker (today by
// default) and its own series, independent of the "Hora a hora" range.
function RainSection({ id, tz }) {
	const [days, setDays] = useState(1)
	const [hoverIdx, setHoverIdx] = useState(null)
	const period = RAIN_PERIODS.find((p) => p.days === days)
	const { points, limited } = useStationSeries(id, period.hours)
	const shownDays = limited ? 1 : days
	const acc = useMemo(
		() => (points ? cumulativeRain(points, { days: shownDays, tz, now: new Date() }) : null),
		[points, shownDays, tz]
	)
	const xLabel = useMemo(() => hourlyXLabel(shownDays * 24), [shownDays])
	const since = acc?.from
		.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
		.replace('-feira', '')
	const place = tz === 'Atlantic/Azores' ? 'hora dos Açores' : 'hora de Portugal continental'

	return (
		<section className="mt-8">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-bold text-gray-900">Chuva acumulada</h2>
					{since && <p className="text-xs text-gray-500">Desde as 00:00 de {since} ({place})</p>}
				</div>
				{!limited && (
					<div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Período da chuva acumulada">
						{RAIN_PERIODS.map((p) => (
							<button
								key={p.days}
								type="button"
								role="tab"
								aria-selected={days === p.days}
								onClick={() => setDays(p.days)}
								className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
									days === p.days ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
								}`}
							>
								{p.label}
							</button>
						))}
					</div>
				)}
			</div>
			{acc === null ? (
				<p className="mt-4 text-sm text-gray-500">A carregar…</p>
			) : acc.total === null ? (
				<p className="mt-4 text-sm text-gray-500">
					{Date.now() - acc.from.getTime() < 2 * 3600 * 1000
						? 'Ainda sem leituras hoje: a primeira leitura do dia é a das 01:00 (chuva entre as 00:00 e as 01:00).'
						: 'Sem leituras de chuva neste período.'}
				</p>
			) : (
				<>
					<p className="mt-3 text-sm text-gray-700">
						{acc.total === 0 && acc.missing === 0 ? (
							'Sem chuva neste período.'
						) : (
							<>
								Total <strong className="text-gray-900 tabular-nums">{acc.missing > 0 ? '≥ ' : ''}{fmtMm(acc.total)}</strong>
								{acc.missing > 0 && <span className="text-gray-500"> ({acc.missing} h sem dados)</span>}
							</>
						)}
					</p>
					<div className="mt-3">
						<StationChart
							title="Acumulado (mm)"
							kind="line"
							points={acc.points}
							format={fmtMm}
							stats={null}
							showLatest={false}
							formatTime={dayHourFmt}
							xLabel={xLabel}
							hoverIdx={hoverIdx}
							onHover={setHoverIdx}
							note="A chuva de cada leitura é a da hora que termina nesse momento: a das 00:00 conta para o dia anterior."
						/>
					</div>
				</>
			)}
		</section>
	)
}

function DailySection({ id, sets }) {
	const daily = useStationDaily(id, 30)
	const [hoverIdx, setHoverIdx] = useState(null)
	if (!daily || daily.length === 0) return null

	const pts = daily.map((d) => ({ ...d, t: new Date(`${d.date}T12:00:00`) }))
	const dayFmt = (t) => t.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
	const xLabel = (p, i) => (i % 7 === 0 || i === pts.length - 1 ? p.t.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '') : null)

	return (
		<section className="mt-10">
			<h2 className="text-lg font-bold text-gray-900">Últimos 30 dias</h2>
			<p className="text-xs text-gray-500">Resumos diários do IPMA, publicados com cerca de 2 dias de atraso</p>
			<div className="mt-4 grid gap-6 lg:grid-cols-2">
				<StationChart
					title="Temperatura mínima e máxima"
					kind="range"
					points={pts}
					format={fmtTemp}
					formatTime={dayFmt}
					xLabel={xLabel}
					hoverIdx={hoverIdx}
					onHover={setHoverIdx}
					thresholds={sets.range}
					note={sets.range.length ? 'Os avisos de Tempo Quente/Frio exigem ≥ 48 h.' : null}
				/>
				<StationChart
					title="Precipitação por dia"
					kind="bar"
					gapUnit="dias"
					showLatest={false}
					points={pts.map((p) => ({ t: p.t, v: p.prec }))}
					format={fmtMm}
					formatTime={dayFmt}
					xLabel={xLabel}
					hoverIdx={hoverIdx}
					onHover={setHoverIdx}
				/>
			</div>
		</section>
	)
}

function Nearby({ station, rows }) {
	const near = rows
		.filter((r) => r.id !== station.id && r.obs)
		.map((r) => ({ ...r, km: haversineKm(station, r) }))
		.sort((a, b) => a.km - b.km)
		.slice(0, 6)
	if (near.length === 0) return null
	return (
		<section className="mt-10">
			<h2 className="text-lg font-bold text-gray-900">Estações próximas</h2>
			<ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
				{near.map((r) => (
					<li key={r.id}>
						<Link
							to={stationPath(r.id, r.name)}
							className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 no-underline hover:border-gray-300 hover:bg-gray-50"
						>
							<span className="min-w-0">
								<span className="block truncate text-sm font-medium text-gray-900">{r.name}</span>
								<span className="block text-xs text-gray-500">{Math.round(r.km)} km</span>
							</span>
							<span className="shrink-0 text-lg font-semibold text-gray-900 tabular-nums">
								{fmtTemp(reading(r.obs, 'temperatura')) ?? '—'}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

export default function EstacaoPage() {
	const { slug } = useParams()
	const navigate = useNavigate()
	const id = stationIdFromSlug(slug)
	const { warnings, stations, stationsStatus, obs, obsHour, updatedAt, retry } = useWarningsData()
	const [showThresholds] = useShowThresholds()

	const rows = useMemo(() => stationRows(stations, obs), [stations, obs])
	const station = rows.find((r) => r.id === id) ?? null
	const seo = station ? stationSeo(station, obsHour) : null

	// Set here, not only in <NotFound>: the parent's effect runs after the
	// child's and would otherwise overwrite title/robots on unknown stations.
	const missing = stationsStatus === 'ready' && !station
	usePageTitle(
		seo ? `${seo.title} · Avisos.pt` : missing ? 'Estação não encontrada · Avisos.pt' : 'Estação meteorológica · Avisos.pt',
		{ description: seo?.description, robots: missing ? 'noindex, follow' : undefined }
	)

	// Old/renamed slug → canonical URL, without a history entry.
	useEffect(() => {
		if (station && `/estacao/${slug}` !== seo.path) navigate(seo.path, { replace: true })
	}, [station, slug, seo?.path, navigate])

	// The station page only needs the catalog; a warnings failure just hides
	// the warning banner.
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
	if (!station) {
		return <NotFound title="Estação não encontrada" message="Esta estação meteorológica não existe ou deixou de reportar ao IPMA." />
	}

	const area = station.area ? IPMA_AREAS[station.area] : null
	const list = warnings && station.area ? areaWarnings(warnings, station.area) : []
	const worst = worstLevelId(list)
	const o = station.obs
	const when = obsDate(obsHour)
	const wind = reading(o, 'intensidadeVentoKM')
	const criteria = station.area ? stationThresholds(station.area) : null
	const sets = chartSets(showThresholds ? criteria : null)

	return (
		<Layout updatedAt={updatedAt}>
			<div className="px-4 mt-6">
				<Breadcrumb
					items={[
						{ label: 'Estações', to: '/estacoes' },
						...(area ? [{ label: area.name, to: districtPath(station.area) }] : []),
						{ label: station.name },
					]}
				/>

				<header className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Estação meteorológica IPMA</p>
						<h1 className="mt-1 text-3xl font-bold text-gray-900 tracking-tight">{station.name}</h1>
						<p className="mt-1 text-sm text-gray-500">
							{area && (
								<Link to={districtPath(station.area)} className="text-gray-600">
									{area.name}
								</Link>
							)}
							{area && ' · '}
							{station.lat.toFixed(3)}, {station.lng.toFixed(3)}
						</p>
					</div>
					<ShareButtons path={seo.path} text={`${station.name}: ${seo.description}`} />
				</header>

				{worst && (
					<Link
						to={districtPath(station.area)}
						className="mt-5 flex items-center gap-3 rounded-xl border border-gray-200 bg-surface px-4 py-3 no-underline hover:bg-gray-50"
					>
						<span className={`shrink-0 w-2 self-stretch rounded-full ${levelMeta(worst).bar}`} aria-hidden />
						<span className="min-w-0 text-sm text-gray-800">
							<strong className="font-semibold">
								{list.length === 1 ? warningHeadline(list[0]) : `${list.length} avisos`} para {area?.name}
							</strong>
							{list.length > 1 && (
								<span className="text-gray-500"> — {[...new Set(list.map((w) => w.awarenessTypeName))].join(', ')}</span>
							)}
						</span>
						<span className="ml-auto shrink-0 text-xs font-semibold text-primary-700">Ver avisos →</span>
					</Link>
				)}

				<section className="mt-6">
					<p className="text-xs text-gray-500">
						{o ? `Leitura das ${when ? timeFmt(when) : '—'} (hora local)` : 'Sem leitura na última hora'}
					</p>
					<div className="mt-2 grid gap-3 grid-cols-2 md:grid-cols-5">
						<div className="col-span-2 md:col-span-1">
							<Tile label="Temperatura" value={fmtTemp(reading(o, 'temperatura'))} hero />
						</div>
						<Tile
							label="Vento médio"
							value={fmtKmh(wind)}
							sub={wind != null && windDir(reading(o, 'idDireccVento')) ? `de ${windDir(reading(o, 'idDireccVento'))}` : null}
						/>
						<Tile label="Chuva (última hora)" value={fmtMm(reading(o, 'precAcumulada'))} />
						<Tile label="Humidade" value={fmtPct(reading(o, 'humidade'))} />
						<Tile label="Pressão" value={fmtHpa(reading(o, 'pressao'))} />
					</div>
				</section>

				{criteria && <ThresholdsToggle areaName={area?.name} regionKey={criteria.region} />}
				<HourlySection id={station.id} sets={sets} region={criteria?.region} />
				<RainSection id={station.id} tz={stationTimeZone(area?.region)} />
				<DailySection id={station.id} sets={sets} />
				<Nearby station={station} rows={rows} />

				<p className="mt-8 text-xs text-gray-500">
					Fonte: IPMA, via API Fogos.pt. Valores em falta significam que a estação não reportou nessa hora.
				</p>
			</div>
		</Layout>
	)
}
