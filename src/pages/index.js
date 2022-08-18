import React, { useEffect, useState, setState } from 'react'
import { Title } from 'tailwind-react-ui'

import Layout from '../layouts/index'

const GetWarnings = async (warning) => {
	const url = 'https://bot-api.vost.pt/getAlertas.php'
	const res = await fetch(url)
	const warnings = await res.json()
	console.log(warnings)

	return warnings
}

export default function IndexPage() {
	const [warnings, setWarnings] = useState(false)

	useEffect(() => {
		async function init() {
			console.log('0lele')
			// eslint-disable-next-line no-shadow
			const warnings = await GetWarnings()
			setWarnings(warnings)
		}
		init()
	}, [])

	const noWarningsEl = (
		<div className="mt-6">
			<Title className="p-3 text-center">Sem Avisos!</Title>
		</div>
	)

	const loadingEl = (
		<Layout>
			<div className="mt-6">
				<Title className="p-3 text-center">A procurar avisos ativos...</Title>
				<div className="fa-3x text-center">
					<i className="fas fa-spinner fa-spin" />
				</div>
			</div>
		</Layout>
	)

	if (warnings === false) {
		return loadingEl
	}

	if (warnings.length === 0) {
		return noWarningsEl
	}

	/**
	 * Remove accents inserted in a string.
	 *
	 * @param {String} messageContent
	 * @returns {String} strAccentsOut
	 */
	const removeAccent = (messageContent) => {
		const strAccents = messageContent.split('')

		let strAccentsOut = []
		const strAccentsLen = strAccents.length

		const accents =
			'ÀÁÂÃÄÅàáâãäåÒÓÔÕÕÖØòóôõöøÈÉÊËèéêëðÇçÐÌÍÎÏìíîïÙÚÛÜùúûüÑñŠšŸÿýŽž'
		const accentsOut =
			'AAAAAAaaaaaaOOOOOOOooooooEEEEeeeeeCcDIIIIiiiiUUUUuuuuNnSsYyyZz'

		for (let y = 0; y < strAccentsLen; y += 1) {
			if (accents.indexOf(strAccents[y]) !== -1) {
				strAccentsOut[y] = accentsOut.substr(accents.indexOf(strAccents[y]), 1)
			} else {
				strAccentsOut[y] = strAccents[y]
			}
		}

		strAccentsOut = strAccentsOut.join('')

		return strAccentsOut
	}

	function getWarningImage(level, weatherType) {
		if (weatherType === 'Precipitação') {
			// eslint-disable-next-line no-param-reassign
			weatherType = 'Chuva'
		} else if (weatherType === 'Agitação Marítima') {
			// eslint-disable-next-line no-param-reassign
			weatherType = 'AgitacaoMaritima'
		} else if (weatherType === 'Tempo Quente') {
			// eslint-disable-next-line no-param-reassign
			weatherType = 'TempoQuente'
		}

		const type = removeAccent(weatherType)
		return `https://bot-api.vost.pt/images/warnings/Twitter_Post_Aviso${level}_${type}.png`
	}

	function renderCards(alarms) {
		const warningsElCard = alarms.map((alarm, i) => (
			<div className="w-full md:w-1/2 xl:w-1/3 border shadow">
				<div>
					<img
						src={getWarningImage(alarm.nivel, alarm.tipo)}
						className="relative"
						alt={alarm.tipo}
					/>
					<h3 className="text-3xl font-extrabold text-gray-900 tracking-tight p-2">
						{alarm.tipo}
					</h3>
					<p className="p-2">{alarm.descricao}</p>
				</div>
				<div className="p-2">
					<p className="text-right text-xs">
						Válido de {alarm.inicio} a {alarm.fim}
					</p>
				</div>
			</div>
		))

		return warningsElCard
	}

	const warningsEl = warnings.map((district, i) => (
		<div className="mt-6">
			<Title className="p-3 text-center" size={6} key={i}>
				{district.local}
			</Title>
			<div className="grid p-6">{renderCards(district.alertas)}</div>
		</div>
	))

	return <Layout>{warningsEl}</Layout>
}
