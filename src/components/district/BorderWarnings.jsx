import { useMemo } from 'react'

import WarningCard from '../warnings/WarningCard.jsx'
import { borderZones } from '../../data/borderZones.js'
import { useAemetWarnings } from '../../hooks/useAemetWarnings.js'
import { useSpainZones } from '../../hooks/useSpainZones.js'
import { borderGroups, borderRegions } from '../../utils/spain.js'

// «Do outro lado da fronteira» (#56): the AEMET warnings of the Spanish zones
// bordering district `code` (BORDER_ZONES), one group per zone, as full
// cards. Nothing for districts without Spanish neighbours. An AEMET failure
// stays inside the section; a failed refresh keeps the last list.
export default function BorderWarnings({ code }) {
	if (borderZones(code).length === 0) return null
	return <Section code={code} />
}

function Section({ code }) {
	const { warnings, error, retry } = useAemetWarnings()
	const zonesMeta = useSpainZones()
	const groups = useMemo(() => borderGroups(code, warnings, zonesMeta), [code, warnings, zonesMeta])
	const regions = borderRegions(code, zonesMeta)
	const any = groups.some((g) => g.warnings.length > 0)

	return (
		<section aria-labelledby="fronteira" className="mt-8">
			<h2 id="fronteira" className="text-lg font-bold text-gray-900">
				Do outro lado da fronteira <span aria-label="Espanha">🇪🇸</span>
			</h2>
			{regions.length > 0 && <p className="mt-1 text-sm text-gray-600">{regions.join(' · ')}</p>}

			<div className="mt-3">
				{warnings === null && error ? (
					<p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
						<i className="fas fa-triangle-exclamation" aria-hidden />
						Não foi possível carregar os avisos de Espanha.
						<button type="button" onClick={retry} className="font-semibold underline">
							Tentar de novo
						</button>
					</p>
				) : warnings === null ? (
					<p className="text-sm text-gray-500">
						<i className="fas fa-spinner fa-spin mr-2" aria-hidden />A carregar os avisos de Espanha…
					</p>
				) : (
					<>
						{error && (
							<p className="mb-3 text-xs text-amber-800 dark:text-amber-200">
								<i className="fas fa-triangle-exclamation mr-1" aria-hidden />
								Não foi possível atualizar os avisos de Espanha.
							</p>
						)}
						{any ? (
							<div className="flex flex-col gap-6">
								{groups.map((g) => (
									<div key={g.code} role="group" aria-labelledby={`fronteira-${g.code}`}>
										<h3 id={`fronteira-${g.code}`} className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-gray-900">
											{g.name}
											{g.province && <span className="text-sm font-normal text-gray-500">{g.province}</span>}
										</h3>
										{g.warnings.length > 0 ? (
											<div className="mt-2 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
												{g.warnings.map((w, i) => (
													<WarningCard key={`${w.awarenessTypeName}-${w.startTime}-${i}`} warning={w} source="aemet" />
												))}
											</div>
										) : (
											<p className="mt-1 text-sm text-gray-500">Sem avisos</p>
										)}
									</div>
								))}
							</div>
						) : (
							<div className="rounded-lg border border-gray-200 bg-surface px-4 py-3 text-sm">
								<p className="m-0 font-semibold text-gray-900">Sem avisos do outro lado da fronteira</p>
								<p className="m-0 mt-1 text-gray-600">
									Zonas vigiadas: {groups.map((g) => (g.province ? `${g.name} (${g.province})` : g.name)).join(' · ')}
								</p>
							</div>
						)}
					</>
				)}
			</div>
		</section>
	)
}
