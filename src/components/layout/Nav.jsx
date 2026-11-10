import { NavLink } from 'react-router-dom'

const LINKS = [
	{ to: '/', label: 'Avisos', end: true },
	{ to: '/cronologia', label: 'Cronologia' },
	{ to: '/mapa', label: 'Mapa' },
	{ to: '/estacoes', label: 'Estações' },
	{ to: '/criterios', label: 'Critérios' },
]

export default function Nav() {
	return (
		<nav className="min-w-0 max-w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			<ul className="flex items-center gap-0.5 sm:gap-1 list-none m-0 p-0">
				{LINKS.map((link) => (
					<li key={link.to}>
						<NavLink
							to={link.to}
							end={link.end}
							className={({ isActive }) =>
								`block whitespace-nowrap px-2 sm:px-3 py-1.5 rounded-md text-[13px] sm:text-sm font-semibold no-underline transition ${
									isActive
										? 'bg-gray-900 text-gray-50'
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
