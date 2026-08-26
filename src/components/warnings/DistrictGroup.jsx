import WarningCard from './WarningCard.jsx'
import ObservationStrip from './ObservationStrip.jsx'

export default function DistrictGroup({ id, name, warnings, station }) {
	return (
		<section id={id} className="mt-10 scroll-mt-6">
			<header className="text-center px-4">
				<h2 className="text-2xl font-bold text-gray-900 tracking-tight">
					{name}
				</h2>
				<ObservationStrip station={station} />
			</header>
			<div className="mt-4 grid gap-4 px-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
				{warnings.map((w, i) => (
					<WarningCard
						key={`${w.awarenessTypeName}-${w.startTime}-${i}`}
						warning={w}
					/>
				))}
			</div>
		</section>
	)
}
