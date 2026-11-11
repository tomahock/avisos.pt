import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

import IndexPage from './pages/index.jsx'
import NotFound from './components/layout/NotFound.jsx'

// Split out the map bundle — Leaflet + GeoJSONs are only needed on /mapa.
const MapPage = lazy(() => import('./pages/mapa.jsx'))
const CronologiaPage = lazy(() => import('./pages/cronologia.jsx'))
const CriteriosPage = lazy(() => import('./pages/criterios.jsx'))
const HistoricoPage = lazy(() => import('./pages/historico.jsx'))
const DistritoPage = lazy(() => import('./pages/distrito.jsx'))
const AvisoPage = lazy(() => import('./pages/aviso.jsx'))
const EstacoesPage = lazy(() => import('./pages/estacoes.jsx'))
const EstacaoPage = lazy(() => import('./pages/estacao.jsx'))

// Every route of the SPA — used by main.jsx and by the page tests, so the
// tests exercise exactly what ships.
export default function AppRoutes() {
	return (
		<Routes>
			<Route path="/" element={<IndexPage />} />
			<Route
				path="/mapa"
				element={
					<Suspense fallback={<div />}>
						<MapPage />
					</Suspense>
				}
			/>
			<Route
				path="/cronologia"
				element={
					<Suspense fallback={<div />}>
						<CronologiaPage />
					</Suspense>
				}
			/>
			<Route
				path="/historico"
				element={
					<Suspense fallback={<div />}>
						<HistoricoPage />
					</Suspense>
				}
			/>
			<Route
				path="/criterios"
				element={
					<Suspense fallback={<div />}>
						<CriteriosPage />
					</Suspense>
				}
			/>
			<Route
				path="/distrito/:slug"
				element={
					<Suspense fallback={<div />}>
						<DistritoPage />
					</Suspense>
				}
			/>
			<Route
				path="/distrito/:slug/aviso/:id"
				element={
					<Suspense fallback={<div />}>
						<AvisoPage />
					</Suspense>
				}
			/>
			<Route
				path="/estacoes"
				element={
					<Suspense fallback={<div />}>
						<EstacoesPage />
					</Suspense>
				}
			/>
			<Route
				path="/estacao/:slug"
				element={
					<Suspense fallback={<div />}>
						<EstacaoPage />
					</Suspense>
				}
			/>
			<Route path="*" element={<NotFound />} />
		</Routes>
	)
}
