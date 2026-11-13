// «Do outro lado da fronteira» (#56): AEMET warnings of the Spanish zones
// bordering a district, as full cards grouped by zone. Fixtures
// (tests/fixtures/data.js `aemetWarnings`): Sanabria (BGC) orange Vento
// "Rachas máximas: 90 km/h" 40%-70%; Costa - Miño de Pontevedra (VCT)
// coastal without a value ("Costeros: "); Litoral de Huelva (FAR) "Polvo en
// suspensión", a type IPMA doesn't have.

import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'

const NOW = new Date('2026-11-13T10:02:00Z')
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const section = async () =>
	(await screen.findByRole('heading', { level: 2, name: /Do outro lado da fronteira/ }, { timeout: 3000 })).closest('section')
const group = async (s, name) => within(s).findByRole('group', { name: new RegExp(`^${name}`) })

describe('border warnings section', () => {
	test('Bragança shows the section with Sanabria orange', async () => {
		mockApi({ now: NOW })
		renderRoute('/distrito/braganca')
		const s = await section()
		expect(s).toHaveAccessibleName('Do outro lado da fronteira Espanha')
		expect(within(s).getByRole('img', { name: 'Espanha' })).toHaveTextContent('🇪🇸')
		// Region and province names come from the static BORDER_ZONE_META (no GeoJSON).
		expect(await within(s).findByText('Galiza · Castela e Leão')).toBeInTheDocument()
		const g = await group(s, 'Sanabria')
		expect(within(g).getByRole('heading', { level: 3 })).toHaveTextContent('Zamora')
		await within(g).findByText('Vento')
		expect(within(g).getByText('Aviso Laranja')).toBeInTheDocument()
		expect(within(g).getByText('Limiar: Rachas máximas: 90 km/h')).toBeInTheDocument()
		expect(within(g).getByText('Probabilidade: 40–70 %')).toBeInTheDocument()
		expect(g).toHaveTextContent('Fonte: AEMET')
		// Not an IPMA warning: no permalink, nothing to share.
		expect(within(s).queryByText('Partilhar')).not.toBeInTheDocument()
		expect(within(g).queryByRole('link', { name: 'Vento' })).not.toBeInTheDocument()
		// Zones without warnings say so.
		expect(within(await group(s, 'Meseta de Zamora')).getByText('Sem avisos')).toBeInTheDocument()
	})

	test('es-zones.geojson down → names, provinces and regions still there, never a raw code', async () => {
		mockApi({ now: NOW, overrides: { '/data/es-zones.geojson': 404 } })
		renderRoute('/distrito/braganca')
		const s = await section()
		expect(within(s).getByText('Galiza · Castela e Leão')).toBeInTheDocument()
		expect(await within(s).findByRole('heading', { level: 3, name: /^Montaña de Ourense/ })).toHaveTextContent('Ourense')
		await within(await group(s, 'Sanabria')).findByText('Vento')
		expect(within(await group(s, 'Sanabria')).getByRole('heading', { level: 3 })).toHaveTextContent('Zamora')
		expect(s.textContent).not.toMatch(/\d{6}/)
	})

	test('while AEMET loads: names already there, no raw codes', async () => {
		let release
		const pending = new Promise((r) => (release = r))
		mockApi({ now: NOW, overrides: { '/api/aemet/warnings': () => pending } })
		renderRoute('/distrito/braganca')
		const s = await section()
		expect(within(s).getByText(/A carregar os avisos de Espanha/)).toBeInTheDocument()
		expect(within(s).getByText('Galiza · Castela e Leão')).toBeInTheDocument()
		expect(s.textContent).not.toMatch(/\d{6}/)
		release(new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }))
		expect(await within(s).findByText('Sem avisos do outro lado da fronteira')).toBeInTheDocument()
		expect(s.textContent).not.toMatch(/\d{6}/)
	})

	test('Lisboa has no section', async () => {
		mockApi({ now: NOW })
		renderRoute('/distrito/lisboa')
		await screen.findByRole('heading', { level: 1, name: 'Avisos meteorológicos para Lisboa' }, { timeout: 3000 })
		expect(screen.queryByRole('heading', { name: /Do outro lado da fronteira/ })).not.toBeInTheDocument()
	})

	test('unmapped_type_renders: Faro shows «Polvo en suspensión»', async () => {
		mockApi({ now: NOW })
		renderRoute('/distrito/faro')
		const s = await section()
		const g = await group(s, 'Litoral de Huelva')
		expect(await within(g).findByText('Polvo en suspensión')).toBeInTheDocument()
		expect(within(g).getByText('Limiar: Visibilidad mínima: 3000 m')).toBeInTheDocument()
	})

	test('section_error_keeps_page: AEMET down → message + retry, PT warnings still there', async () => {
		mockApi({ now: NOW, overrides: { '/api/aemet/warnings': 502 } })
		const { user } = renderRoute('/distrito/faro')
		const s = await section()
		expect(await within(s).findByText(/Não foi possível carregar os avisos de Espanha\./)).toBeInTheDocument()
		expect(within(s).getByRole('status')).toHaveTextContent('Não foi possível carregar os avisos de Espanha.')
		const retry = within(s).getByRole('button', { name: 'Tentar de novo' })
		expect(screen.getByRole('heading', { level: 2, name: 'Avisos' })).toBeInTheDocument()
		expect(screen.getByText('Ondas de sudoeste com 4 a 5 metros.')).toBeInTheDocument()

		// Retry once AEMET is back.
		mockApi({ now: NOW })
		await user.click(retry)
		expect(await within(s).findByText('Polvo en suspensión')).toBeInTheDocument()
		expect(within(s).queryByText(/Não foi possível carregar/)).not.toBeInTheDocument()
	})

	test('empty_parameter_hidden: Viana coastal card has no «Limiar»', async () => {
		mockApi({ now: NOW })
		renderRoute('/distrito/viana-do-castelo')
		const s = await section()
		expect(await within(s).findByText('Galiza')).toBeInTheDocument() // only Galiza borders Viana
		const g = await group(s, 'Costa - Miño de Pontevedra')
		await within(g).findByText('Agitação Marítima')
		expect(g).not.toHaveTextContent('Limiar')
		expect(within(g).getByText('Probabilidade: 40–70 %')).toBeInTheDocument()
	})

	test('no warnings in any zone → one message and the watched zones', async () => {
		mockApi({ now: NOW, overrides: { '/api/aemet/warnings': [] } })
		renderRoute('/distrito/guarda')
		const s = await section()
		expect(await within(s).findByText('Sem avisos do outro lado da fronteira')).toBeInTheDocument()
		expect(within(s).queryByRole('group')).not.toBeInTheDocument()
		expect(await within(s).findByText(/Meseta de Salamanca \(Salamanca\)/)).toHaveTextContent('Norte de Cáceres (Cáceres)')
	})
})
