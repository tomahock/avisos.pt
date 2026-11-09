import { useSearchParams } from 'react-router-dom'

import Layout from '../layouts/index.jsx'
import {
	CRITERIA_CONSULTED_AT,
	CRITERIA_GUIDE_URL,
	CRITERIA_REGIONS,
	CRITERIA_SOURCE_URL,
	LEVEL_MEANING,
	SNOW_IMPACTS,
	THUNDER_PHENOMENA,
} from '../data/criterios.js'
import { LEVELS } from '../data/levels.js'
import { warningTypeMeta } from '../data/warningTypes.js'
import { usePageTitle } from '../utils/pageTitle.js'
import { PAGE_META } from '../utils/share.js'

const LEVEL_IDS = ['yellow', 'orange', 'red']

function LevelMeaning() {
	return (
		<section className="mt-8">
			<h2 className="text-lg font-bold text-gray-900">O que significa cada cor</h2>
			<div className="mt-3 grid gap-3 md:grid-cols-3">
				{LEVEL_IDS.map((id) => (
					<article
						key={id}
						className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
					>
						<div className={`px-4 py-2 text-sm font-bold uppercase tracking-wide ${LEVELS[id].chip}`}>
							{LEVELS[id].label}
						</div>
						<div className="p-4">
							<p className="text-sm text-gray-900 font-medium leading-snug">
								{LEVEL_MEANING[id].meaning}
							</p>
							<p className="mt-2 text-sm text-gray-600 leading-snug">
								<i className="fas fa-arrow-right mr-1.5 text-gray-400" aria-hidden />
								{LEVEL_MEANING[id].action}
							</p>
						</div>
					</article>
				))}
			</div>
			<p className="mt-3 text-xs text-gray-500">
				<span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 mr-1.5 align-middle" aria-hidden />
				<strong className="font-semibold text-gray-700">Verde</strong> — {LEVEL_MEANING.green.meaning}
			</p>
		</section>
	)
}

function RegionTabs({ selected, onSelect }) {
	return (
		<div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit max-w-full overflow-x-auto" role="tablist">
			{CRITERIA_REGIONS.map((r) => {
				const active = r.key === selected
				return (
					<button
						key={r.key}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onSelect(r.key)}
						className={`shrink-0 px-4 py-1.5 rounded-md text-sm font-semibold transition ${
							active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
						}`}
					>
						{r.short}
					</button>
				)
			})}
		</div>
	)
}

function ScaleHeader() {
	return (
		<div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
			{LEVEL_IDS.map((id) => (
				<span key={id} className="flex items-center gap-1">
					<span className={`w-2 h-2 rounded-full ${LEVELS[id].bar}`} aria-hidden />
					{LEVELS[id].label}
				</span>
			))}
		</div>
	)
}

function ThresholdRow({ row }) {
	return (
		<div>
			{row.note && <p className="text-xs font-medium text-gray-600 mb-1">{row.note}</p>}
			<div className="grid grid-cols-3 gap-1.5">
				{LEVEL_IDS.map((id) => (
					<div
						key={id}
						className={`rounded-md px-2 py-2 text-center ${LEVELS[id].chip}`}
						title={`${LEVELS[id].label}: ${row[id]} ${row.unit}`}
					>
						<span className="block text-base font-bold tabular-nums leading-tight whitespace-nowrap">
							{row[id]}
						</span>
						<span className="block text-[11px] opacity-80">{row.unit}</span>
					</div>
				))}
			</div>
		</div>
	)
}

function LevelTexts({ texts }) {
	return (
		<ul className="list-none m-0 p-0 space-y-2">
			{LEVEL_IDS.map((id) => (
				<li key={id} className="flex gap-2.5">
					<span className={`shrink-0 w-1.5 rounded-full ${LEVELS[id].bar}`} aria-hidden />
					<p className="text-sm text-gray-700 leading-snug m-0">
						<strong className={`font-semibold ${LEVELS[id].text}`}>{LEVELS[id].label}.</strong>{' '}
						{texts[id]}
					</p>
				</li>
			))}
		</ul>
	)
}

function TypeCard({ item }) {
	const meta = warningTypeMeta(item.type)
	return (
		<article className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
			<header className="flex items-start gap-3">
				<div className="shrink-0 w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center">
					<i className={`fas ${meta.icon}`} aria-hidden />
				</div>
				<div className="min-w-0">
					<h3 className="font-bold text-gray-900 leading-tight">{meta.label ?? item.type}</h3>
					<p className="text-xs text-gray-500 mt-0.5">{item.parameter}</p>
				</div>
			</header>

			{item.thunder ? (
				<>
					<p className="text-xs text-gray-500 m-0">Fenómenos esperados por nível de aviso:</p>
					<LevelTexts texts={THUNDER_PHENOMENA} />
				</>
			) : (
				<>
					<ScaleHeader />
					{item.rows.map((row, i) => (
						<ThresholdRow key={i} row={row} />
					))}
				</>
			)}

			{item.type === 'Neve' && (
				<details className="group text-sm">
					<summary className="cursor-pointer text-primary-700 font-medium select-none">
						Impactos prováveis
					</summary>
					<div className="mt-2">
						<LevelTexts texts={SNOW_IMPACTS} />
					</div>
				</details>
			)}
		</article>
	)
}

function TemperatureTable({ region }) {
	const heat = warningTypeMeta('Tempo Quente')
	const cold = warningTypeMeta('Tempo Frio')
	const cell = 'px-2 py-1.5 text-center tabular-nums whitespace-nowrap'
	const head = (id) => `${cell} text-[10px] font-semibold uppercase tracking-wider ${LEVELS[id].chip}`

	return (
		<section className="mt-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
			<header className="p-4 pb-3">
				<h3 className="font-bold text-gray-900">Tempo Frio e Tempo Quente por {region.areaLabel.toLowerCase()}</h3>
				<p className="text-xs text-gray-500 mt-0.5">
					Temperatura mínima (frio) e máxima (quente), em °C, com duração ≥ 48 horas. Os limiares
					dependem do clima habitual de cada {region.areaLabel.toLowerCase()}.
				</p>
			</header>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="text-xs text-gray-600">
							<th className="text-left font-semibold px-4 py-2" rowSpan={2}>
								{region.areaLabel}
							</th>
							<th className="font-semibold px-2 py-2 border-l border-gray-100" colSpan={3}>
								<i className={`fas ${cold.icon} mr-1.5 text-sky-600`} aria-hidden />
								Tempo Frio · mínima
							</th>
							<th className="font-semibold px-2 py-2 border-l border-gray-100" colSpan={3}>
								<i className={`fas ${heat.icon} mr-1.5 text-red-600`} aria-hidden />
								Tempo Quente · máxima
							</th>
						</tr>
						<tr>
							{[...LEVEL_IDS, ...LEVEL_IDS].map((id, i) => (
								<th key={i} className={head(id)}>
									{LEVELS[id].label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{region.temperatures.map(([name, min, max]) => (
							<tr key={name} className="border-t border-gray-100 even:bg-gray-50/60">
								<th scope="row" className="text-left font-medium text-gray-900 px-4 py-1.5 whitespace-nowrap">
									{name}
								</th>
								{min.map((v, i) => (
									<td key={`min${i}`} className={`${cell} ${i === 0 ? 'border-l border-gray-100' : ''}`}>
										{v}
									</td>
								))}
								{max.map((v, i) => (
									<td key={`max${i}`} className={`${cell} ${i === 0 ? 'border-l border-gray-100' : ''}`}>
										{v}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	)
}

function formatConsulted(iso) {
	const [y, m, d] = iso.split('-').map(Number)
	return new Date(y, m - 1, d).toLocaleDateString('pt-PT', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}

export default function CriteriosPage() {
	usePageTitle(`${PAGE_META['/criterios'].title} · Avisos.pt`, {
		description: PAGE_META['/criterios'].description,
	})

	const [searchParams, setSearchParams] = useSearchParams()
	const region =
		CRITERIA_REGIONS.find((r) => r.key === searchParams.get('regiao')) ?? CRITERIA_REGIONS[0]
	const select = (key) =>
		setSearchParams(key === CRITERIA_REGIONS[0].key ? {} : { regiao: key }, { replace: true })

	const cards = region.types.filter((t) => !t.temperature)

	return (
		<Layout>
			<div className="px-4 mt-6">
				<header>
					<h1 className="text-2xl font-bold text-gray-900 tracking-tight">
						Critérios de emissão de avisos
					</h1>
					<p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl">
						O IPMA emite avisos meteorológicos sempre que prevê ou observa fenómenos adversos
						que, nas próximas 72 horas, possam causar danos ou prejuízos. Os avisos são
						emitidos por distrito (e por região nas ilhas), e a cor reflete a intensidade do
						fenómeno. Quando há avisos para vários fenómenos, a região fica com a cor do mais
						grave.
					</p>
				</header>

				<LevelMeaning />

				<section className="mt-10">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 className="text-lg font-bold text-gray-900">Limiares por tipo de aviso</h2>
							<p className="text-sm text-gray-500">{region.title}</p>
						</div>
						<RegionTabs selected={region.key} onSelect={select} />
					</div>

					<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{cards.map((item) => (
							<TypeCard key={item.type} item={item} />
						))}
					</div>

					<TemperatureTable region={region} />
				</section>

				<aside className="mt-8 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600 leading-relaxed">
					<p className="m-0">
						<i className="fas fa-circle-info mr-1.5 text-gray-400" aria-hidden />
						Perante a emissão de avisos, siga as recomendações e medidas de autoproteção da{' '}
						<a href="https://www.prociv.gov.pt" className="text-primary-700 underline" target="_blank" rel="noreferrer">
							ANEPC
						</a>
						{' '}e, em situações de frio ou calor, da{' '}
						<a href="https://www.dgs.pt" className="text-primary-700 underline" target="_blank" rel="noreferrer">
							DGS
						</a>
						.
					</p>
					<p className="mt-2 mb-0 text-xs text-gray-500">
						Fonte:{' '}
						<a href={CRITERIA_SOURCE_URL} className="underline" target="_blank" rel="noreferrer">
							IPMA — Critérios de emissão dos avisos meteorológicos
						</a>{' '}
						e{' '}
						<a href={CRITERIA_GUIDE_URL} className="underline" target="_blank" rel="noreferrer">
							Guia de utilização
						</a>
						, consultados a {formatConsulted(CRITERIA_CONSULTED_AT)}. Em caso de diferença,
						prevalece a informação do IPMA.
					</p>
				</aside>
			</div>
		</Layout>
	)
}
