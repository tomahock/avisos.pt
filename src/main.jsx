import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './index.css'

import IndexPage from './pages/index.jsx'

// Split out the map bundle — Leaflet + GeoJSONs are only needed on /mapa.
const MapPage = lazy(() => import('./pages/mapa.jsx'))
const CronologiaPage = lazy(() => import('./pages/cronologia.jsx'))
const CriteriosPage = lazy(() => import('./pages/criterios.jsx'))

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<BrowserRouter>
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
					path="/criterios"
					element={
						<Suspense fallback={<div />}>
							<CriteriosPage />
						</Suspense>
					}
				/>
			</Routes>
		</BrowserRouter>
	</StrictMode>
)
