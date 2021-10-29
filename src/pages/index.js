import React, { useEffect, useState } from 'react'
import {
	Card,
	CardBody,
	Image,
	CardFooter,
	Title,
	Subtitle,
} from 'tailwind-react-ui'
import Layout from '../layouts/index'
import WarningsCard from '../components/WarningCard'

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

	if (warnings === false) {
		return <p>loading...</p>
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
		}
		const type = removeAccent(weatherType)
		return `https://bot-api.vost.pt/images/warnings/Twitter_Post_Aviso${level}_${type}.png`
	}

	function renderCards(alarms) {
		const warningsElCard = alarms.map((alarm, i) => (
			<Card border shadow className="w-full md:w-1/2 xl:w-1/3">
				<CardBody>
					<Image
						src={getWarningImage(alarm.nivel, alarm.tipo)}
						aspectRatio={1793 / 896}
						className="relative"
					/>
					<Subtitle size={4}>{alarm.tipo}</Subtitle>
					<p>{alarm.descricao}</p>
				</CardBody>
				<CardFooter>
					<p>
						Válido de {alarm.inicio} a {alarm.fim}
					</p>
				</CardFooter>
			</Card>
		))

		return warningsElCard
	}

	const warningsEl = warnings.map((district, i) => (
		<div className="container">
			<Title size={6} key={i}>
				{district.local}
			</Title>
			<div className="flex flex-row flex-wrap flex-grow mt-2">
				{renderCards(district.alertas)}
			</div>
		</div>
	))

	return (
		<Layout>
			<div className="container">{warningsEl}</div>
		</Layout>
	)
}
