import { Link } from 'react-router-dom'

import { useShowThresholds } from '../../hooks/useShowThresholds.js'

// One line above the charts: what the dashed lines are, a link to the
// criteria of the station's region, and the on/off switch (shared).
export default function ThresholdsToggle({ areaName, regionKey }) {
	const [show, setShow] = useShowThresholds()
	return (
		<div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-gray-500">
			<p className="m-0">
				{show ? (
					<>
						Linhas tracejadas: limiares de aviso do IPMA para {areaName} ·{' '}
						<Link to={`/criterios?regiao=${regionKey}`} className="text-primary-700">
							critérios
						</Link>
					</>
				) : (
					'Limiares de aviso escondidos'
				)}
			</p>
			<label className="inline-flex cursor-pointer items-center gap-2 font-medium text-gray-700">
				<input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-primary-600" />
				Mostrar limiares
			</label>
		</div>
	)
}
