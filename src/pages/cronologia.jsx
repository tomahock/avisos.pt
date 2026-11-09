import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import StateEmpty from '../components/warnings/StateEmpty.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import TimelineGrid from '../components/timeline/TimelineGrid.jsx'
import TypeIcon from '../components/warnings/TypeIcon.jsx'
import {
	ACORES_CODES,
	CONTINENTAL_CODES,
	IPMA_AREAS,
	MADEIRA_CODES,
	areaChip,
	areaName,
} from '../data/ipmaAreas.js'
import { LEVELS, levelMeta, worstLevelId } from '../data/levels.js'
import { typeRank, warningTypeMeta } from '../data/warningTypes.js'
import { typeRows } from '../components/timeline/typeRows.js'
import { fetchJson } from '../utils/fetchJson.js'
import { formatWhen, parseWarningTime } from '../utils/format.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { PAGE_META, districtPath } from '../utils/share.js'
import {
	buildHours,
	durationHours,
	relativeWindow,
} from '../utils/timeline.js'

const REGIONS = [
	{ key: 'continental', title: 'Portugal Continental', codes: CONTINENTAL_CODES },
	{ key: 'acores', title: 'Açores', codes: ACORES_CODES },
	{ key: 'madeira', title: 'Madeira', codes: MADEIRA_CODES },
]

function groupBy(list, key) {
	const map = new Map()
	for (const item of list) {
		const k = item[key]
		const arr = map.get(k)
		if (arr) arr.push(item)
		else map.set(k, [item])
	}
	return map
}

function AreaPicker({ selected, onSelect, warningsByArea }) {
	const base =
		'shrink-0 px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide transition border'
	return (
		<div className="space-y-3">
			<button
				type="button"
				onClick={() => onSelect(null)}
				className={`${base} ${
					selected === null
						? 'bg-gray-900 text-white border-gray-900'
						: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
				}`}
			>
				<i className="fas fa-table-cells mr-1.5" aria-hidden />
				Todos
			</button>
			{REGIONS.map((region) => (
				<div key={region.key}>
					<h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
						{region.title}
					</h3>
					<div className="flex flex-wrap gap-1.5">
						{region.codes.map((code) => {
							const list = warningsByArea.get(code)
							const worst = list ? worstLevelId(list) : null
							const isSel = selected === code
							const cls = worst
								? `${levelMeta(worst).chip} border-transparent hover:opacity-90`
								: 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
							return (
								<button
									key={code}
									type="button"
									onClick={() => onSelect(code)}
									title={IPMA_AREAS[code].name}
									className={`${base} ${cls} ${
										isSel ? 'ring-2 ring-offset-2 ring-gray-900' : ''
									}`}
								>
									{areaChip(code)}
								</button>
							)
						})}
					</div>
				</div>
			))}
		</div>
	)
}

function Legend() {
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
			{['yellow', 'orange', 'red'].map((id) => (
				<span key={id} className="inline-flex items-center gap-1.5">
					<span className={`w-4 h-3 rounded-sm ${LEVELS[id].bar}`} aria-hidden />
					{LEVELS[id].label}
				</span>
			))}
			<span className="inline-flex items-center gap-1.5">
				<span className="w-0.5 h-3 bg-secondary-500" aria-hidden />
				Agora
			</span>
			<span className="text-gray-400">
				Hora local · passe o rato (ou toque) numa hora para ver o detalhe
			</span>
		</div>
	)
}

function WarningRow({ warning, now }) {
	const level = levelMeta(warning.awarenessLevelID)
	const type = warningTypeMeta(warning.awarenessTypeName)
	const rel = relativeWindow(warning, now)
	const hours = durationHours(warning)
	return (
		<li className="flex gap-3 py-4 border-b border-gray-100 last:border-b-0">
			<div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${level.chip}`}>
				<TypeIcon type={warning.awarenessTypeName} />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
					<h3 className="font-semibold text-gray-900">
						{type.label ?? warning.awarenessTypeName}
					</h3>
					<span className={`text-xs font-semibold uppercase tracking-wide ${level.text}`}>
						{level.label}
					</span>
					<span
						className={`text-xs font-medium px-2 py-0.5 rounded-full ${
							rel.active ? 'bg-secondary-50 text-secondary-700' : 'bg-gray-100 text-gray-600'
						}`}
					>
						{rel.active && (
							<span className="inline-block w-1.5 h-1.5 mr-1 rounded-full bg-secondary-500 align-middle animate-pulse" />
						)}
						{rel.active ? 'Em vigor · ' : ''}
						{rel.text}
					</span>
				</div>
				<p className="text-xs text-gray-500 mt-0.5 tabular-nums">
					{formatWhen(warning.startTime)} → {formatWhen(warning.endTime)} · {hours} h
				</p>
				<p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{warning.text}</p>
			</div>
		</li>
	)
}

export default function CronologiaPage() {
	const [searchParams, setSearchParams] = useSearchParams()
	const selected = IPMA_AREAS[searchParams.get('d')] ? searchParams.get('d') : null

	usePageTitle(
		selected
			? `Cronologia · ${areaName(selected)} · Avisos.pt`
			: `${PAGE_META['/cronologia'].title} · Avisos.pt`,
		{ description: PAGE_META['/cronologia'].description }
	)

	const [warnings, setWarnings] = useState(null)
	const [error, setError] = useState(null)
	const [updatedAt, setUpdatedAt] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)
	const [now, setNow] = useState(() => new Date())

	useEffect(() => {
		const ctrl = new AbortController()
		fetchJson('/api/warnings', ctrl.signal)
			.then((data) => {
				setWarnings(data)
				setUpdatedAt(new Date())
				setNow(new Date())
			})
			.catch((err) => {
				if (err.name !== 'AbortError') setError(err.message)
			})
		return () => ctrl.abort()
	}, [reloadKey])

	// Keep the "now" marker moving without refetching.
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 60 * 1000)
		return () => clearInterval(id)
	}, [])

	const retry = useCallback(() => {
		setError(null)
		setWarnings(null)
		setReloadKey((k) => k + 1)
	}, [])

	const select = useCallback(
		(code) => setSearchParams(code ? { d: code } : {}),
		[setSearchParams]
	)

	const warningsByArea = useMemo(
		() => (warnings ? groupBy(warnings, 'idAreaAviso') : new Map()),
		[warnings]
	)

	// Recompute the window only when the hour rolls over, not every minute.
	const hourKey = Math.floor(now.getTime() / 3600000)
	const hours = useMemo(
		() => buildHours(warnings ?? [], now),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[warnings, hourKey]
	)

	const overviewRows = useMemo(() => {
		const rows = []
		for (const region of REGIONS) {
			rows.push({ type: 'section', key: region.key, label: region.title })
			for (const code of region.codes) {
				rows.push({
					key: code,
					label: areaChip(code),
					warnings: warningsByArea.get(code) ?? [],
					onClick: () => select(code),
				})
			}
		}
		return rows
	}, [warningsByArea, select])

	const areaWarnings = useMemo(
		() => (selected ? warningsByArea.get(selected) ?? [] : []),
		[selected, warningsByArea]
	)

	const districtRows = useMemo(() => typeRows(areaWarnings), [areaWarnings])

	const sortedAreaWarnings = useMemo(
		() =>
			[...areaWarnings].sort(
				(a, b) =>
					parseWarningTime(a.startTime) - parseWarningTime(b.startTime) ||
					typeRank(a.awarenessTypeName) - typeRank(b.awarenessTypeName)
			),
		[areaWarnings]
	)

	if (error) {
		return (
			<Layout>
				<StateError message={error} onRetry={retry} />
			</Layout>
		)
	}

	if (warnings === null) {
		return (
			<Layout>
				<StateLoading />
			</Layout>
		)
	}

	if (warnings.length === 0) {
		return (
			<Layout updatedAt={updatedAt}>
				<StateEmpty />
			</Layout>
		)
	}

	return (
		<Layout updatedAt={updatedAt}>
			<div className="px-4 mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] items-start">
				<aside className="lg:sticky lg:top-6">
					<AreaPicker
						selected={selected}
						onSelect={select}
						warningsByArea={warningsByArea}
					/>
				</aside>

				<div className="min-w-0 space-y-4">
					<header>
						<h1 className="text-2xl font-bold text-gray-900 tracking-tight">
							{selected ? areaName(selected) : 'Cronologia dos avisos'}
						</h1>
						{selected && (
							<Link to={districtPath(selected)} className="text-sm text-primary-700">
								Página de {areaName(selected)} →
							</Link>
						)}
						<p className="text-sm text-gray-500 mt-1">
							{selected
								? `${areaWarnings.length} ${areaWarnings.length === 1 ? 'aviso' : 'avisos'} nas próximas ${hours.length} horas`
								: `Pior nível de aviso por hora em cada região, nas próximas ${hours.length} horas. Toque numa região para ver o detalhe.`}
						</p>
					</header>

					{selected && areaWarnings.length === 0 ? (
						<div className="border border-gray-200 rounded-xl p-8 text-center">
							<div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
								<i className="fas fa-check text-xl text-green-600" aria-hidden />
							</div>
							<p className="mt-3 font-semibold text-gray-900">
								Sem avisos para {areaName(selected)}
							</p>
						</div>
					) : (
						<TimelineGrid
							hours={hours}
							now={now}
							rows={selected ? districtRows : overviewRows}
							mode={selected ? 'level' : 'types'}
						/>
					)}

					<Legend />

					{selected && sortedAreaWarnings.length > 0 && (
						<section className="pt-2">
							<h2 className="text-lg font-bold text-gray-900">Avisos por ordem cronológica</h2>
							<ul className="mt-1 list-none p-0 m-0">
								{sortedAreaWarnings.map((w, i) => (
									<WarningRow
										key={`${w.awarenessTypeName}-${w.startTime}-${i}`}
										warning={w}
										now={now}
									/>
								))}
							</ul>
						</section>
					)}
				</div>
			</div>
		</Layout>
	)
}
