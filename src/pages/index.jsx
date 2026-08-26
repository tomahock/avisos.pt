import { useEffect, useState } from 'react'

import Layout from '../layouts/index.jsx'
import { areaName } from '../data/ipmaAreas.js'

// FogosPT: filenames on bot-api.vost.pt don't match the API's `awarenessTypeName`
// 1:1. Overrides applied before accent-stripping.
const TYPE_FILENAME_OVERRIDES = {
	'Precipitação': 'Chuva',
	'Agitação Marítima': 'AgitacaoMaritima',
	'Tempo Quente': 'TempoQuente',
}

// FogosPT levels → Portuguese labels used in bot-api image filenames.
const LEVEL_LABEL = {
	yellow: 'Amarelo',
	orange: 'Laranja',
	red: 'Vermelho',
}

// Full literal class names so Tailwind's JIT picks them up.
const LEVEL_BORDER = {
	yellow: 'border-yellow-400',
	orange: 'border-orange-500',
	red: 'border-red-600',
}

function removeAccents(str) {
	return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function getWarningImage(level, weatherType) {
	const levelLabel = LEVEL_LABEL[level]
	if (!levelLabel) return null
	const mapped = TYPE_FILENAME_OVERRIDES[weatherType] ?? weatherType
	const type = removeAccents(mapped)
	return `https://bot-api.vost.pt/images/warnings/Twitter_Post_Aviso${levelLabel}_${type}.png`
}

function formatWhen(iso) {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString('pt-PT', {
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function groupByArea(warnings) {
	const map = new Map()
	for (const w of warnings) {
		if (!map.has(w.idAreaAviso)) map.set(w.idAreaAviso, [])
		map.get(w.idAreaAviso).push(w)
	}
	return Array.from(map, ([id, items]) => ({ id, name: areaName(id), items }))
}

function Heading({ children, className = '' }) {
	return (
		<h2 className={`text-2xl font-bold text-gray-900 tracking-tight ${className}`}>
			{children}
		</h2>
	)
}

function WarningCard({ warning }) {
	const img = getWarningImage(warning.awarenessLevelID, warning.awarenessTypeName)
	const border = LEVEL_BORDER[warning.awarenessLevelID] ?? 'border-gray-300'
	return (
		<div className={`w-full md:w-1/2 xl:w-1/3 border-4 shadow ${border}`}>
			{img && (
				<img src={img} className="relative" alt={warning.awarenessTypeName} />
			)}
			<h3 className="text-3xl font-extrabold text-gray-900 tracking-tight p-2">
				{warning.awarenessTypeName}
			</h3>
			<p className="p-2">{warning.text}</p>
			<div className="p-2">
				<p className="text-right text-xs">
					Válido de {formatWhen(warning.startTime)} a {formatWhen(warning.endTime)}
				</p>
			</div>
		</div>
	)
}

export default function IndexPage() {
	const [warnings, setWarnings] = useState(null)
	const [error, setError] = useState(null)

	useEffect(() => {
		fetch('/api/warnings')
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				return res.json()
			})
			.then(setWarnings)
			.catch((err) => setError(err.message))
	}, [])

	if (error !== null) {
		return (
			<Layout>
				<div className="mt-6">
					<Heading className="p-3 text-center">Erro a carregar avisos</Heading>
					<p className="text-center text-sm text-gray-500 p-2">{error}</p>
				</div>
			</Layout>
		)
	}

	if (warnings === null) {
		return (
			<Layout>
				<div className="mt-6">
					<Heading className="p-3 text-center">A procurar avisos ativos...</Heading>
					<div className="fa-3x text-center">
						<i className="fas fa-spinner fa-spin" />
					</div>
				</div>
			</Layout>
		)
	}

	if (warnings.length === 0) {
		return (
			<Layout>
				<div className="mt-6">
					<Heading className="p-3 text-center">Sem Avisos!</Heading>
				</div>
			</Layout>
		)
	}

	const groups = groupByArea(warnings)

	return (
		<Layout>
			{groups.map((group) => (
				<div key={group.id} className="mt-6">
					<Heading className="p-3 text-center">{group.name}</Heading>
					<div className="grid p-6">
						{group.items.map((w, i) => (
							<WarningCard
								key={`${w.awarenessTypeName}-${w.startTime}-${i}`}
								warning={w}
							/>
						))}
					</div>
				</div>
			))}
		</Layout>
	)
}
