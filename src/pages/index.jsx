import { useEffect, useState } from 'react'

import Layout from '../layouts/index.jsx'

const WARNINGS_API = 'https://bot-api.vost.pt/getAlertas.php'

async function fetchWarnings() {
	const res = await fetch(WARNINGS_API)
	return res.json()
}

// Filenames on bot-api.vost.pt do not match the API's `tipo` strings 1:1.
// These renames are applied before accent-stripping.
const TYPE_FILENAME_OVERRIDES = {
	'Precipitação': 'Chuva',
	'Agitação Marítima': 'AgitacaoMaritima',
	'Tempo Quente': 'TempoQuente',
}

function removeAccents(str) {
	return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function getWarningImage(level, weatherType) {
	const mapped = TYPE_FILENAME_OVERRIDES[weatherType] ?? weatherType
	const type = removeAccents(mapped)
	return `https://bot-api.vost.pt/images/warnings/Twitter_Post_Aviso${level}_${type}.png`
}

function Heading({ children, className = '' }) {
	return (
		<h2 className={`text-2xl font-bold text-gray-900 tracking-tight ${className}`}>
			{children}
		</h2>
	)
}

function WarningCard({ alarm }) {
	return (
		<div className="w-full md:w-1/2 xl:w-1/3 border shadow">
			<img
				src={getWarningImage(alarm.nivel, alarm.tipo)}
				className="relative"
				alt={alarm.tipo}
			/>
			<h3 className="text-3xl font-extrabold text-gray-900 tracking-tight p-2">
				{alarm.tipo}
			</h3>
			<p className="p-2">{alarm.descricao}</p>
			<div className="p-2">
				<p className="text-right text-xs">
					Válido de {alarm.inicio} a {alarm.fim}
				</p>
			</div>
		</div>
	)
}

export default function IndexPage() {
	const [warnings, setWarnings] = useState(null)

	useEffect(() => {
		fetchWarnings().then(setWarnings)
	}, [])

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

	return (
		<Layout>
			{warnings.map((district) => (
				<div key={district.local} className="mt-6">
					<Heading className="p-3 text-center">{district.local}</Heading>
					<div className="grid p-6">
						{district.alertas.map((alarm, i) => (
							<WarningCard key={`${alarm.tipo}-${i}`} alarm={alarm} />
						))}
					</div>
				</div>
			))}
		</Layout>
	)
}
