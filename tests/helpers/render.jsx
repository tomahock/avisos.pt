import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

import AppRoutes from '../../src/routes.jsx'

let location
function LocationSpy() {
	location = useLocation()
	return null
}

// Renders the real route table at `path`. `currentUrl()` returns where the
// app navigated to (pathname + search).
export function renderRoute(path) {
	const user = userEvent.setup()
	const utils = render(
		<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
			<AppRoutes />
			<LocationSpy />
		</MemoryRouter>
	)
	return { ...utils, user, currentUrl: () => location.pathname + location.search }
}
