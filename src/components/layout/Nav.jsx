import { NavLink } from 'react-router-dom'

const LINKS = [
	{ to: '/', label: 'Avisos', end: true },
	{ to: '/mapa', label: 'Mapa' },
]

export default function Nav() {
	return (
		<nav>
			<ul className="flex items-center gap-1 list-none m-0 p-0">
				{LINKS.map((link) => (
					<li key={link.to}>
						<NavLink
							to={link.to}
							end={link.end}
							className={({ isActive }) =>
								`px-3 py-1.5 rounded-md text-sm font-semibold no-underline transition ${
									isActive
										? 'bg-gray-900 text-white'
										: 'text-gray-600 hover:bg-gray-100'
								}`
							}
						>
							{link.label}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	)
}
