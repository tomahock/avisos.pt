import { Link } from 'react-router-dom'

import { relativeMinutes } from '../../utils/format.js'

export default function Header({ updatedAt }) {
	return (
		<header className="px-6 pt-6 pb-4 border-b border-gray-100">
			<div className="flex items-baseline gap-3 flex-wrap">
				<Link to="/" className="flex items-center gap-2 no-underline text-gray-900">
					<img className="h-8 w-auto" src="/imgs/logo.png" alt="" />
					<span className="text-xl font-extrabold tracking-tight">Avisos.pt</span>
				</Link>
				<span className="text-sm text-gray-500">
					Avisos meteorológicos em vigor em Portugal
				</span>
				{updatedAt && (
					<span className="ml-auto text-xs text-gray-400">
						Actualizado {relativeMinutes(updatedAt)}
					</span>
				)}
			</div>
		</header>
	)
}
