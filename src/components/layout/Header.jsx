import { Link } from 'react-router-dom'

import Nav from './Nav.jsx'
import { relativeMinutes } from '../../utils/format.js'

export default function Header({ updatedAt }) {
	return (
		<header className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100">
			<div className="flex items-center gap-x-4 gap-y-3 flex-wrap">
				<Link to="/" className="flex items-center gap-2 no-underline text-gray-900">
					<img className="h-8 w-auto" src="/imgs/logo.png" alt="" />
					<span className="text-xl font-extrabold tracking-tight">Avisos.pt</span>
				</Link>
				<span className="text-sm text-gray-500 hidden sm:inline">
					Avisos meteorológicos em vigor em Portugal
				</span>
				<div className="w-full md:w-auto md:ml-auto flex items-center gap-4 min-w-0">
					{updatedAt && (
						<span className="text-xs text-gray-400 hidden md:inline">
							Actualizado {relativeMinutes(updatedAt)}
						</span>
					)}
					<Nav />
				</div>
			</div>
		</header>
	)
}
