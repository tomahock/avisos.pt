import { Link } from 'react-router-dom'

export default function Breadcrumb({ items }) {
	return (
		<nav aria-label="Navegação estrutural" className="text-xs text-gray-500">
			<ol className="flex flex-wrap items-center gap-1.5 list-none m-0 p-0">
				{items.map((item, i) => (
					<li key={item.label} className="flex items-center gap-1.5">
						{i > 0 && <i className="fas fa-chevron-right text-[9px] text-gray-300" aria-hidden />}
						{item.to ? (
							<Link to={item.to} className="text-gray-500 no-underline hover:text-gray-900">
								{item.label}
							</Link>
						) : (
							<span className="text-gray-700 font-medium">{item.label}</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	)
}
