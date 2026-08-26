import { formatTemp, formatWind, formatHumidity, formatPrecip } from '../../utils/format.js'

// Compact strip shown next to a district heading. `station` shape:
//   { name, distanceKm, obs: { temperatura, intensidadeVentoKM, idDireccVento, humidade, precAcumulada, ... } }
// If nothing valid to show, returns null (caller can skip rendering).
export default function ObservationStrip({ station }) {
	if (!station) return null
	const { obs } = station
	const temp = formatTemp(obs.temperatura)
	const wind = formatWind(obs.intensidadeVentoKM, obs.idDireccVento)
	const humidity = formatHumidity(obs.humidade)
	const precip = formatPrecip(obs.precAcumulada)

	const parts = [
		temp && { icon: 'fa-temperature-half', text: temp },
		wind && { icon: 'fa-wind', text: wind },
		precip && precip !== '0 mm' && { icon: 'fa-cloud-rain', text: precip },
		humidity && { icon: 'fa-droplet', text: humidity },
	].filter(Boolean)

	if (parts.length === 0) return null

	return (
		<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
			{parts.map((p) => (
				<span key={p.icon} className="inline-flex items-center gap-1.5">
					<i className={`fas ${p.icon} text-gray-400`} aria-hidden />
					{p.text}
				</span>
			))}
			<span className="text-xs text-gray-400">
				· {station.name} ({Math.round(station.distanceKm)} km)
			</span>
		</div>
	)
}
