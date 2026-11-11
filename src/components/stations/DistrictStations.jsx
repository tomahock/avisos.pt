import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import Sparkline from './Sparkline.jsx'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { useShowThresholds } from '../../hooks/useShowThresholds.js'
import { LEVELS, levelMeta } from '../../data/levels.js'
import { chartSets, latestLevel } from '../../utils/chartThresholds.js'
import { levelWord, stationThresholds } from '../../utils/criteriaThresholds.js'
import { fetchJson } from '../../utils/fetchJson.js'
import { STATION_METRICS, defaultStationMetric, rainTotal } from '../../utils/stationMetrics.js'
import { fmtKmh, fmtMm, fmtPct, fmtTemp, reading, stationPath, stationRows, windDir } from '../../utils/stations.js'

const FORMAT = { temperatura: fmtTemp, chuva: fmtMm, vento: fmtKmh, humidade: fmtPct }

// Threshold sets drawn on each measure's sparkline. Rain: the hourly bars vs
// mm/1h (no 6 h sum on a 96 px chart).
function sparkSets(sets, metric) {
	if (metric === 'temperatura') return sets.temperatura
	if (metric === 'chuva') return sets.chuva.filter((s) => s.key === 'rain1h')
	if (metric === 'vento') return sets.vento
	return []
}


// Small line under the station name: the measures that aren't the big one.
function secondary(o, metric) {
	const wind = reading(o, 'intensidadeVentoKM')
	const parts = {
		temperatura: fmtTemp(reading(o, 'temperatura')),
		vento: wind != null ? `${fmtKmh(wind)}${windDir(reading(o, 'idDireccVento')) ? ` ${windDir(reading(o, 'idDireccVento'))}` : ''}` : null,
		chuva: reading(o, 'precAcumulada') > 0 ? `${fmtMm(reading(o, 'precAcumulada'))}/h` : null,
		humidade: fmtPct(reading(o, 'humidade')),
	}
	return Object.entries(parts)
		.filter(([k, v]) => k !== metric && v)
		.map(([, v]) => v)
		.join(' · ')
}

function LevelChip({ level }) {
	if (!level) return null
	return (
		<span data-level-chip={level} title={`Última leitura acima do limiar ${levelWord(level)} do IPMA`} className={`shrink-0 rounded px-1 py-px text-[10px] font-bold leading-tight ${LEVELS[level].chip}`}>
			≥ {levelWord(level)}
		</span>
	)
}

// Stations inside one IPMA area: current reading + 24 h trend of one measure.
// The measure defaults to what the district's warnings are about (rain for a
// rain/thunderstorm warning, wind for wind, temperature otherwise) and can be
// switched by the visitor.
export default function DistrictStations({ code, name, catalog, obs, warnings, now }) {
	const rows = useMemo(
		() =>
			stationRows(catalog, obs)
				.filter((r) => r.area === code)
				.sort((a, b) => (a.obs ? 0 : 1) - (b.obs ? 0 : 1) || a.name.localeCompare(b.name, 'pt')),
		[catalog, obs, code]
	)
	const ids = rows.map((r) => r.id).join(',')
	const [series, setSeries] = useState({})
	// Re-evaluated as time passes (`now` ticks every minute on the district
	// page): a warning starting or ending changes which one matters most.
	const minute = now ? Math.floor(now.getTime() / 60000) : 0
	const auto = useMemo(
		() => defaultStationMetric(warnings, now ?? new Date()),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[warnings, minute]
	)
	const [picked, setPicked] = useState(null)
	const narrow = useMediaQuery('(max-width: 639px)')
	const metric = picked ?? auto.metric
	const meta = STATION_METRICS[metric]
	const [showThresholds] = useShowThresholds()
	const criteria = useMemo(() => stationThresholds(code), [code])
	const sets = useMemo(() => sparkSets(chartSets(showThresholds ? criteria : null), metric), [criteria, showThresholds, metric])

	// The user's choice belongs to one district; reset when navigating.
	useEffect(() => setPicked(null), [code])

	useEffect(() => {
		if (!ids) return
		const ctrl = new AbortController()
		fetchJson(`/api/observations/recent?stations=${ids}`, ctrl.signal)
			.then((data) => setSeries(data?.stations ?? {}))
			.catch(() => {})
		return () => ctrl.abort()
	}, [ids])

	if (rows.length === 0) return null

	const trendOf = (id) => (series[id] ?? []).map((o) => reading(o, meta.field))
	// Rain: the 24 h total says more than the last hour. Hours without a
	// reading make it a lower bound (≥), never a silent 0.
	const rain24 = (id) => rainTotal(trendOf(id))
	const bigValue = (r) => {
		if (metric !== 'chuva') return FORMAT[metric](reading(r.obs, meta.field))
		const { total, missing } = rain24(r.id)
		if (total == null) return null
		return `${missing > 0 ? '≥ ' : ''}${fmtMm(total)}`
	}
	const rainNote = (id) => {
		const { total, missing } = rain24(id)
		return metric === 'chuva' && total != null && missing > 0 ? `${missing} h sem dados` : null
	}
	// 24 h extremes under the big value — bare numbers, the unit is already on
	// the big value: max/min for temperature and humidity, max for wind,
	// wettest hour for rain (the 24 h total is the big one).
	const extremes = (id) => {
		const vals = trendOf(id).filter((v) => v != null)
		if (vals.length === 0) return null
		const digits = metric === 'temperatura' || metric === 'chuva' ? 1 : 0
		const n = (v) => v.toLocaleString('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits })
		const max = Math.max(...vals)
		const min = Math.min(...vals)
		if (metric === 'chuva') return max > 0 ? `máx. ${n(max)}/h` : null
		if (metric === 'vento') return `máx. ${n(max)}`
		return `máx. ${n(max)} · mín. ${n(min)}`
	}

	const tab = (key) =>
		`px-3 py-1 rounded-md text-xs font-semibold transition ${metric === key ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`

	return (
		<section className="mt-10">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-bold text-gray-900">Estações meteorológicas em {name}</h2>
					<p className="text-xs text-gray-500 mt-0.5">
						{metric === 'chuva'
							? 'Chuva acumulada nas últimas 24 horas e hora mais chuvosa'
							: `${meta.label} agora, com ${metric === 'vento' ? 'o máximo' : 'máximo e mínimo'} das últimas 24 horas`}
						{!picked && auto.warning && (
							<>
								{' '}
								— escolhido por haver aviso{' '}
								<span className={`font-semibold ${levelMeta(auto.warning.awarenessLevelID).text}`}>
									{levelMeta(auto.warning.awarenessLevelID).label.toLowerCase()}
								</span>{' '}
								de {auto.warning.awarenessTypeName}
							</>
						)}
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Medida">
						{Object.entries(STATION_METRICS).map(([key, m]) => (
							<button key={key} type="button" role="tab" aria-selected={metric === key} onClick={() => setPicked(key)} className={tab(key)}>
								{m.label}
							</button>
						))}
					</div>
					<Link to="/estacoes" className="hidden sm:inline text-sm text-primary-700">Todas as estações →</Link>
				</div>
			</div>
			<ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 list-none m-0 p-0">
				{rows.map((r) => (
					<li key={r.id}>
						<Link
							to={stationPath(r.id, r.name)}
							className="flex items-center gap-3 rounded-lg border border-gray-200 bg-surface px-3 py-2 no-underline hover:border-gray-300 hover:bg-gray-50"
						>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium text-gray-900">{r.name}</span>
								<span className="flex min-w-0 items-center gap-1.5">
									{showThresholds && <LevelChip level={latestLevel(criteria, metric, reading(r.obs, meta.field))} />}
									<span className="truncate text-xs text-gray-500">{r.obs ? secondary(r.obs, metric) || '—' : 'Sem leitura na última hora'}</span>
								</span>
							</span>
							<Sparkline
								values={trendOf(r.id)}
								kind={meta.kind}
								width={narrow ? 64 : 96}
								label={`${meta.label} nas últimas 24 horas em ${r.name}`}
								thresholds={sets}
							/>
							<span className="w-[5.75rem] shrink-0 text-right">
								<span className="block text-lg font-semibold leading-tight text-gray-900 tabular-nums">{bigValue(r) ?? '—'}</span>
								{[extremes(r.id), rainNote(r.id)].some(Boolean) && (
									<span className="block text-[11px] leading-tight text-gray-500 tabular-nums">
										{[extremes(r.id), rainNote(r.id)].filter(Boolean).join(' · ')}
									</span>
								)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}
