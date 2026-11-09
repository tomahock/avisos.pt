import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import Sparkline from './Sparkline.jsx'
import { levelMeta } from '../../data/levels.js'
import { fetchJson } from '../../utils/fetchJson.js'
import { STATION_METRICS, defaultStationMetric } from '../../utils/stationMetrics.js'
import { fmtKmh, fmtMm, fmtPct, fmtTemp, reading, stationPath, stationRows, windDir } from '../../utils/stations.js'

const FORMAT = { temperatura: fmtTemp, chuva: fmtMm, vento: fmtKmh, humidade: fmtPct }

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

// Stations inside one IPMA area: current reading + 24 h trend of one measure.
// The measure defaults to what the district's warnings are about (rain for a
// rain/thunderstorm warning, wind for wind, temperature otherwise) and can be
// switched by the visitor.
export default function DistrictStations({ code, name, catalog, obs, warnings }) {
	const rows = useMemo(
		() =>
			stationRows(catalog, obs)
				.filter((r) => r.area === code)
				.sort((a, b) => (a.obs ? 0 : 1) - (b.obs ? 0 : 1) || a.name.localeCompare(b.name, 'pt')),
		[catalog, obs, code]
	)
	const ids = rows.map((r) => r.id).join(',')
	const [series, setSeries] = useState({})
	const auto = useMemo(() => defaultStationMetric(warnings), [warnings])
	const [picked, setPicked] = useState(null)
	const metric = picked ?? auto.metric
	const meta = STATION_METRICS[metric]

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
	// Rain: the 24 h total says more than the last hour.
	const rain24 = (id) => {
		const vals = trendOf(id).filter((v) => v != null)
		return vals.length ? vals.reduce((s, v) => s + v, 0) : null
	}
	const bigValue = (r) => (metric === 'chuva' ? fmtMm(rain24(r.id)) : FORMAT[metric](reading(r.obs, meta.field)))

	const tab = (key) =>
		`px-3 py-1 rounded-md text-xs font-semibold transition ${metric === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`

	return (
		<section className="mt-10">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-bold text-gray-900">Estações meteorológicas em {name}</h2>
					<p className="text-xs text-gray-500 mt-0.5">
						{metric === 'chuva' ? 'Chuva acumulada nas últimas 24 horas' : `${meta.label} agora e nas últimas 24 horas`}
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
							className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 no-underline hover:border-gray-300 hover:bg-gray-50"
						>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium text-gray-900">{r.name}</span>
								<span className="block truncate text-xs text-gray-500">{r.obs ? secondary(r.obs, metric) || '—' : 'Sem leitura na última hora'}</span>
							</span>
							<Sparkline
								values={trendOf(r.id)}
								kind={meta.kind}
								label={`${meta.label} nas últimas 24 horas em ${r.name}`}
							/>
							<span className="w-20 shrink-0 text-right text-lg font-semibold text-gray-900 tabular-nums">{bigValue(r) ?? '—'}</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}
