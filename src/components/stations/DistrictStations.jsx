import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import Sparkline from './Sparkline.jsx'
import { fetchJson } from '../../utils/fetchJson.js'
import { fmtKmh, fmtMm, fmtPct, fmtTemp, reading, stationPath, stationRows, windDir } from '../../utils/stations.js'

// Stations inside one IPMA area: current reading + 24 h temperature trend.
export default function DistrictStations({ code, name, catalog, obs }) {
	const rows = useMemo(
		() =>
			stationRows(catalog, obs)
				.filter((r) => r.area === code)
				.sort((a, b) => (a.obs ? 0 : 1) - (b.obs ? 0 : 1) || a.name.localeCompare(b.name, 'pt')),
		[catalog, obs, code]
	)
	const ids = rows.map((r) => r.id).join(',')
	const [trend, setTrend] = useState({})

	useEffect(() => {
		if (!ids) return
		const ctrl = new AbortController()
		fetchJson(`/api/observations/recent?stations=${ids}`, ctrl.signal)
			.then((data) => {
				const out = {}
				for (const [id, list] of Object.entries(data?.stations ?? {})) out[id] = list.map((o) => reading(o, 'temperatura'))
				setTrend(out)
			})
			.catch(() => {})
		return () => ctrl.abort()
	}, [ids])

	if (rows.length === 0) return null

	return (
		<section className="mt-10">
			<div className="flex items-baseline justify-between gap-3">
				<h2 className="text-lg font-bold text-gray-900">Estações meteorológicas em {name}</h2>
				<Link to="/estacoes" className="text-sm text-primary-700">Todas as estações →</Link>
			</div>
			<ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 list-none m-0 p-0">
				{rows.map((r) => {
					const o = r.obs
					const extras = [
						fmtKmh(reading(o, 'intensidadeVentoKM')) &&
							`${fmtKmh(reading(o, 'intensidadeVentoKM'))}${windDir(reading(o, 'idDireccVento')) ? ` ${windDir(reading(o, 'idDireccVento'))}` : ''}`,
						reading(o, 'precAcumulada') > 0 && fmtMm(reading(o, 'precAcumulada')),
						fmtPct(reading(o, 'humidade')),
					].filter(Boolean)
					return (
						<li key={r.id}>
							<Link
								to={stationPath(r.id, r.name)}
								className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 no-underline hover:border-gray-300 hover:bg-gray-50"
							>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-medium text-gray-900">{r.name}</span>
									<span className="block truncate text-xs text-gray-500">{o ? extras.join(' · ') || '—' : 'Sem leitura na última hora'}</span>
								</span>
								<Sparkline values={trend[r.id] ?? []} label={`Temperatura nas últimas 24 horas em ${r.name}`} />
								<span className="w-16 shrink-0 text-right text-lg font-semibold text-gray-900 tabular-nums">
									{fmtTemp(reading(o, 'temperatura')) ?? '—'}
								</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
