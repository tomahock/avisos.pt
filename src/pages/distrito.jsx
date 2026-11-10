import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import NotFound from '../components/layout/NotFound.jsx'
import ObservationStrip from '../components/warnings/ObservationStrip.jsx'
import ShareButtons from '../components/share/ShareButtons.jsx'
import StateError from '../components/warnings/StateError.jsx'
import StateLoading from '../components/warnings/StateLoading.jsx'
import WarningCard from '../components/warnings/WarningCard.jsx'
import Breadcrumb from '../components/district/Breadcrumb.jsx'
import DistrictTimeline from '../components/district/DistrictTimeline.jsx'
import OtherAreas from '../components/district/OtherAreas.jsx'
import DistrictStations from '../components/stations/DistrictStations.jsx'
import DistrictIncidents from '../components/district/DistrictIncidents.jsx'
import { IPMA_AREAS, areaCentroid, codeFromSlug } from '../data/ipmaAreas.js'
import { levelMeta, worstLevelId } from '../data/levels.js'
import { useNow } from '../hooks/useNow.js'
import { useWarningsData } from '../hooks/useWarningsData.js'
import { nearestStationWithObs } from '../utils/geo.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { areaWarnings, districtPath, districtSeo, sortWarnings } from '../utils/share.js'

const REGION_LABEL = {
	continental: 'Portugal Continental',
	acores: 'Arquipélago dos Açores',
	madeira: 'Arquipélago da Madeira',
}

export default function DistritoPage() {
	const { slug } = useParams()
	const code = codeFromSlug(slug)
	if (!code) return <NotFound title="Distrito não encontrado" message="Este distrito ou região não existe. Escolha um na lista de avisos ou no mapa." />
	return <District code={code} />
}

function District({ code }) {
	const { warnings, stations, obs, error, updatedAt, retry } = useWarningsData()
	const now = useNow()
	const area = IPMA_AREAS[code]

	const list = useMemo(() => (warnings ? sortWarnings(areaWarnings(warnings, code)) : []), [warnings, code])
	const seo = districtSeo(code, warnings)
	usePageTitle(`${seo.title} · Avisos.pt`, { description: seo.description })

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

	const worst = worstLevelId(list)
	const level = levelMeta(worst)
	const station = nearestStationWithObs(areaCentroid(code), stations, obs)

	return (
		<Layout updatedAt={updatedAt}>
			<div className="px-4 mt-6">
				<Breadcrumb items={[{ label: 'Avisos', to: '/' }, { label: area.name }]} />

				<header className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
							{REGION_LABEL[area.region]}
						</p>
						<h1 className="mt-1 text-3xl font-bold text-gray-900 tracking-tight">
							Avisos meteorológicos para {area.name}
						</h1>
						<div className="mt-2 flex flex-wrap items-center gap-3">
							<span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${worst ? level.chip : 'bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300'}`}>
								{worst ? `Aviso ${level.label}` : 'Sem avisos'}
							</span>
							<span className="text-sm text-gray-500">
								{list.length === 0
									? 'Nenhum aviso em vigor ou previsto'
									: `${list.length} ${list.length === 1 ? 'aviso' : 'avisos'} em vigor ou previstos`}
							</span>
						</div>
						<div className="[&>div]:justify-start">
							<ObservationStrip station={station} />
						</div>
					</div>
					<ShareButtons path={districtPath(code)} text={`${seo.title}: ${seo.description}`} />
				</header>

				{list.length > 0 ? (
					<>
						<section className="mt-6">
							<h2 className="sr-only">Cronologia</h2>
							<DistrictTimeline list={list} now={now} />
						</section>
						<section className="mt-8">
							<h2 className="text-lg font-bold text-gray-900">Avisos</h2>
							<div className="mt-3 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
								{list.map((w, i) => (
									<WarningCard key={`${w.awarenessTypeName}-${w.startTime}-${i}`} warning={w} />
								))}
							</div>
						</section>
					</>
				) : (
					<div className="mt-8 border border-gray-200 rounded-xl p-8 text-center">
						<div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-950/60">
							<i className="fas fa-check text-xl text-green-600 dark:text-green-400" aria-hidden />
						</div>
						<p className="mt-3 font-semibold text-gray-900">Sem avisos meteorológicos para {area.name}</p>
						<p className="mt-1 text-sm text-gray-500">O IPMA não tem avisos em vigor nem previstos para esta região.</p>
					</div>
				)}

				<DistrictIncidents code={code} />

				<p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
					<Link to={`/cronologia?d=${code}`} className="text-primary-700">Cronologia hora a hora</Link>
					<Link to="/mapa" className="text-primary-700">Ver no mapa</Link>
					<Link to="/criterios" className="text-primary-700">Critérios dos avisos</Link>
				</p>

				<DistrictStations code={code} name={area.name} catalog={stations} obs={obs} warnings={list} now={now} />

				<OtherAreas current={code} warnings={warnings} />
			</div>
		</Layout>
	)
}
