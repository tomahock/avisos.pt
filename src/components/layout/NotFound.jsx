import { Link, useLocation } from 'react-router-dom'

import Layout from '../../layouts/index.jsx'
import { usePageTitle } from '../../utils/pageTitle.js'

const LINKS = [
	{ to: '/', label: 'Avisos em vigor', icon: 'fa-triangle-exclamation' },
	{ to: '/mapa', label: 'Mapa', icon: 'fa-map' },
	{ to: '/cronologia', label: 'Cronologia', icon: 'fa-clock' },
	{ to: '/estacoes', label: 'Estações meteorológicas', icon: 'fa-temperature-half' },
	{ to: '/criterios', label: 'Critérios dos avisos', icon: 'fa-list-check' },
]

// Generic "not found" page: the catch-all route and the per-page "unknown
// district / station" states. The server answers these URLs with a real 404
// (functions/_middleware.js); this is what the visitor sees.
export default function NotFound({ title = 'Página não encontrada', message }) {
	const { pathname } = useLocation()
	usePageTitle(`${title} · Avisos.pt`, { robots: 'noindex, follow' })

	return (
		<Layout>
			<div className="mx-auto max-w-xl px-6 py-16 text-center">
				<p className="text-6xl font-extrabold tracking-tight text-gray-200">404</p>
				<h1 className="mt-2 text-2xl font-bold text-gray-900">{title}</h1>
				<p className="mt-2 text-sm text-gray-500">
					{message ?? (
						<>
							O endereço <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 break-all">{pathname}</code> não existe ou
							mudou de sítio.
						</>
					)}
				</p>

				<ul className="mt-8 grid gap-2 sm:grid-cols-2 list-none m-0 p-0 text-left">
					{LINKS.map((l) => (
						<li key={l.to}>
							<Link
								to={l.to}
								className="flex items-center gap-3 rounded-lg border border-gray-200 bg-surface px-4 py-3 text-sm font-medium text-gray-800 no-underline hover:border-gray-300 hover:bg-gray-50"
							>
								<i className={`fas ${l.icon} w-4 text-center text-gray-400`} aria-hidden />
								{l.label}
							</Link>
						</li>
					))}
				</ul>

				<p className="mt-8 text-xs text-gray-500">
					Chegou aqui a partir de um link do Avisos.pt?{' '}
					<a href="https://github.com/tomahock/avisos.pt/issues/new" target="_blank" rel="noreferrer" className="text-primary-700">
						Avise-nos
					</a>
					.
				</p>
			</div>
		</Layout>
	)
}
