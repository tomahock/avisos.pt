import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import NotFound from '../components/layout/NotFound.jsx'
import ShareButtons from '../components/share/ShareButtons.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import WarningCard from '../components/warnings/WarningCard.jsx'
import TypeIcon from '../components/warnings/TypeIcon.jsx'
import Breadcrumb from '../components/district/Breadcrumb.jsx'
import DistrictTimeline from '../components/district/DistrictTimeline.jsx'
import OtherAreas from '../components/district/OtherAreas.jsx'
import { IPMA_AREAS, codeFromSlug } from '../data/ipmaAreas.js'
import { levelMeta } from '../data/levels.js'
import { warningTypeMeta } from '../data/warningTypes.js'
import { useNow } from '../hooks/useNow.js'
import { useWarningsData } from '../hooks/useWarningsData.js'
import { formatWhen } from '../utils/format.js'
import { usePageTitle } from '../utils/pageTitle.js'
import {
	areaWarnings,
	districtPath,
	findWarning,
	sortWarnings,
	warningPath,
	warningSeo,
} from '../utils/share.js'
import { durationHours, relativeWindow } from '../utils/timeline.js'

function WarningHero({ warning, now }) {
	const level = levelMeta(warning.awarenessLevelID)
	const type = warningTypeMeta(warning.awarenessTypeName)
	const rel = relativeWindow(warning, now)
	const seo = warningSeo(warning)
	const area = IPMA_AREAS[warning.idAreaAviso]

	return (
		<article className="mt-4 bg-surface border border-gray-200 rounded-xl shadow-sm overflow-hidden">
			<div className={`h-2 ${level.bar}`} aria-hidden />
			<div className="p-5 md:p-7">
				<div className="flex items-start gap-4">
					<div className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${level.chip}`}>
						<TypeIcon type={warning.awarenessTypeName} className="text-2xl" />
					</div>
					<div className="min-w-0">
						<p className={`text-xs font-bold uppercase tracking-wider ${level.text}`}>Aviso {level.label}</p>
						<h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
							{type.label ?? warning.awarenessTypeName}
							<span className="text-gray-400 font-semibold"> · </span>
							<Link to={districtPath(warning.idAreaAviso)} className="text-gray-900 no-underline hover:underline">
								{area?.name ?? warning.idAreaAviso}
							</Link>
						</h1>
					</div>
				</div>

				<dl className="mt-5 grid gap-3 sm:grid-cols-3">
					<div className="rounded-lg bg-gray-50 px-4 py-3">
						<dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Início</dt>
						<dd className="m-0 mt-0.5 font-semibold text-gray-900 tabular-nums">{formatWhen(warning.startTime)}</dd>
					</div>
					<div className="rounded-lg bg-gray-50 px-4 py-3">
						<dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Fim</dt>
						<dd className="m-0 mt-0.5 font-semibold text-gray-900 tabular-nums">{formatWhen(warning.endTime)}</dd>
					</div>
					<div className={`rounded-lg px-4 py-3 ${rel.active ? 'bg-secondary-50' : 'bg-gray-50'}`}>
						<dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Estado</dt>
						<dd className={`m-0 mt-0.5 font-semibold ${rel.active ? 'text-secondary-700' : 'text-gray-900'}`}>
							{rel.active ? 'Em vigor · ' : ''}
							{rel.text} <span className="font-normal text-gray-500">({durationHours(warning)} h)</span>
						</dd>
					</div>
				</dl>

				<p className="mt-5 text-base text-gray-800 leading-relaxed">{warning.text}</p>

				<div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
					<p className="m-0 text-xs text-gray-500">
						Fonte: IPMA. Horas na hora local do seu dispositivo.{' '}
						<Link to="/criterios" className="text-primary-700">O que significa este nível?</Link>
					</p>
					<ShareButtons path={warningPath(warning)} text={seo.title} />
				</div>
			</div>
		</article>
	)
}

export default function AvisoPage() {
	const { slug, id } = useParams()
	const code = codeFromSlug(slug)
	const { warnings, error, updatedAt, retry } = useWarningsData()
	const now = useNow()

	const warning = useMemo(() => (warnings && code ? findWarning(warnings, code, id) : null), [warnings, code, id])
	const others = useMemo(
		() => (warnings && code ? sortWarnings(areaWarnings(warnings, code).filter((w) => w !== warning)) : []),
		[warnings, code, warning]
	)
	const areaList = useMemo(() => (warnings && code ? areaWarnings(warnings, code) : []), [warnings, code])

	const name = code ? IPMA_AREAS[code].name : 'Aviso'
	const seo = warning ? warningSeo(warning) : null
	usePageTitle(seo ? `${seo.title} · Avisos.pt` : code ? `Aviso terminado — ${name} · Avisos.pt` : 'Distrito não encontrado · Avisos.pt', {
		description: seo?.description,
		// Warnings expire; keep them out of the index (district pages are the
		// durable URLs). Matches functions/_middleware.js.
		robots: 'noindex, follow',
	})

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
	if (!code) {
		return <NotFound title="Distrito não encontrado" message="Este distrito ou região não existe. Escolha um na lista de avisos ou no mapa." />
	}

	return (
		<Layout updatedAt={updatedAt}>
			<div className="px-4 mt-6">
				<Breadcrumb
					items={[
						{ label: 'Avisos', to: '/' },
						{ label: name, to: districtPath(code) },
						{ label: warning ? warningTypeMeta(warning.awarenessTypeName).label ?? warning.awarenessTypeName : 'Aviso' },
					]}
				/>

				{warning ? (
					<WarningHero warning={warning} now={now} />
				) : (
					<div className="mt-4 border border-gray-200 rounded-xl p-8 text-center">
						<div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
							<i className="fas fa-clock-rotate-left text-xl text-gray-500" aria-hidden />
						</div>
						<h1 className="mt-3 text-xl font-bold text-gray-900">Este aviso já terminou ou foi atualizado</h1>
						<p className="mt-1 text-sm text-gray-500">
							Veja os{' '}
							<Link to={districtPath(code)} className="text-primary-700">avisos em vigor para {name}</Link>.
						</p>
					</div>
				)}

				{areaList.length > 0 && (
					<section className="mt-8">
						<h2 className="text-lg font-bold text-gray-900">Cronologia para {name}</h2>
						<div className="mt-3">
							<DistrictTimeline list={areaList} now={now} />
						</div>
					</section>
				)}

				{others.length > 0 && (
					<section className="mt-8">
						<h2 className="text-lg font-bold text-gray-900">
							{warning ? `Outros avisos para ${name}` : `Avisos para ${name}`}
						</h2>
						<div className="mt-3 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
							{others.map((w, i) => (
								<WarningCard key={`${w.awarenessTypeName}-${w.startTime}-${i}`} warning={w} />
							))}
						</div>
					</section>
				)}

				<OtherAreas current={code} warnings={warnings} />
			</div>
		</Layout>
	)
}
