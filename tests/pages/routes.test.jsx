// Every route of the SPA rendered with the real route table, the real Pages
// Functions and a fake FogosPT: normal data, no warnings, API down, bad URLs.

import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { STATION_ID } from '../fixtures/data.js'
import { mockApi } from '../helpers/api.js'
import { renderRoute } from '../helpers/render.jsx'
import { warningSlug } from '../../src/utils/share.js'

const h1 = async (name) => expect(await screen.findByRole('heading', { level: 1, name }, { timeout: 3000 })).toBeInTheDocument()

describe('pages render with normal data', () => {
	test('/', async () => {
		mockApi()
		renderRoute('/')
		expect(await screen.findAllByRole('link', { name: /Lisboa/ })).not.toHaveLength(0)
		expect(screen.queryByText(/Não foi possível/)).not.toBeInTheDocument()
	})
	test('/cronologia', async () => {
		mockApi()
		renderRoute('/cronologia')
		await h1('Cronologia dos avisos')
	})
	test('footer credits AEMET', async () => {
		mockApi()
		renderRoute('/')
		const footer = await screen.findByRole('contentinfo')
		const link = within(footer).getByRole('link', { name: 'AEMET (Agencia Estatal de Meteorología)' })
		expect(link).toHaveAttribute('href', 'https://www.aemet.es')
		expect(footer).toHaveTextContent(/AEMET \(Agencia Estatal de Meteorología\); através da API do Fogos\.pt/)
	})
	test('/cronologia?d=LSB selects a district', async () => {
		mockApi()
		renderRoute('/cronologia?d=LSB')
		await h1('Lisboa')
		expect(screen.getByRole('link', { name: /Página de Lisboa/ })).toHaveAttribute('href', '/distrito/lisboa')
	})
	test('/historico', async () => {
		mockApi()
		renderRoute('/historico')
		await h1('Histórico de avisos')
		expect(await screen.findAllByText('Agravado')).not.toHaveLength(0)
	})
	test('/criterios', async () => {
		mockApi()
		renderRoute('/criterios')
		await h1('Critérios de emissão de avisos')
		expect(screen.getByRole('heading', { name: 'O que significa cada cor' })).toBeInTheDocument()
	})
	test('/distrito/lisboa', async () => {
		const { fx } = mockApi()
		renderRoute('/distrito/lisboa')
		await h1('Avisos meteorológicos para Lisboa')
		expect(screen.getAllByText('Aviso Laranja').length).toBeGreaterThan(0)
		expect(document.title).toBe('Avisos meteorológicos para Lisboa · Avisos.pt')
		expect(fx).toBeTruthy()
	})
	test('/distrito/<island area> and MRM (no polygon) still render', async () => {
		mockApi()
		renderRoute('/distrito/madeira-regioes-montanhosas')
		await h1('Avisos meteorológicos para Madeira – Regiões Montanhosas')
	})
	test('/distrito/<slug>/aviso/<id>', async () => {
		const { fx } = mockApi()
		const w = fx.warnings.find((x) => x.idAreaAviso === 'LSB' && x.awarenessTypeName === 'Vento')
		renderRoute(`/distrito/lisboa/aviso/${warningSlug(w)}`)
		await h1(/^Vento\s*·\s*Lisboa$/)
		expect(screen.getByText('Aviso Laranja')).toBeInTheDocument()
	})
	test('/estacoes', async () => {
		mockApi()
		renderRoute('/estacoes')
		await h1('Estações meteorológicas IPMA')
		expect(await screen.findAllByRole('link', { name: /Lisboa \(Geofísico\)/ })).not.toHaveLength(0)
	})
	test('/estacao/<id>-<slug>', async () => {
		mockApi()
		renderRoute(`/estacao/${STATION_ID}-lisboa-geofisico`)
		await h1('Lisboa (Geofísico)')
		expect(await screen.findByRole('heading', { name: 'Hora a hora' })).toBeInTheDocument()
	})
})

describe('unknown things are real "not found" pages', () => {
	test.each([
		['/xpto', 'Página não encontrada'],
		['/distrito/atlantida', 'Distrito não encontrado'],
		['/distrito/atlantida/aviso/vento-20261111-1430', 'Distrito não encontrado'],
		['/estacao/123-nada', 'Estação não encontrada'],
		['/estacao/nada', 'Estação não encontrada'],
	])('%s', async (path, title) => {
		mockApi()
		renderRoute(path)
		await h1(title)
	})
	test('an expired/unknown warning id says it ended', async () => {
		mockApi()
		renderRoute('/distrito/lisboa/aviso/vento-19990101-0000')
		await h1('Este aviso já terminou ou foi atualizado')
	})
})

describe('renamed station slug is canonicalised', () => {
	test('/estacao/<id>-nome-antigo → current slug', async () => {
		mockApi()
		const { currentUrl } = renderRoute(`/estacao/${STATION_ID}-nome-antigo`)
		await h1('Lisboa (Geofísico)')
		await waitFor(() => expect(currentUrl()).toBe(`/estacao/${STATION_ID}-lisboa-geofisico`))
	})
})

describe('no warnings at all', () => {
	test.each(['/', '/cronologia'])('%s shows the empty state', async (path) => {
		mockApi({ overrides: { '/api/warnings': [] } })
		renderRoute(path)
		expect(await screen.findByRole('heading', { name: 'Sem avisos meteorológicos' })).toBeInTheDocument()
	})
	test('/distrito/lisboa says there are none', async () => {
		mockApi({ overrides: { '/api/warnings': [] } })
		renderRoute('/distrito/lisboa')
		expect(await screen.findByText('Sem avisos meteorológicos para Lisboa')).toBeInTheDocument()
	})
	test('/historico with no events explains when recording started', async () => {
		mockApi({ overrides: { '/api/warnings/history': [] } })
		renderRoute('/historico')
		expect(await screen.findByText('Ainda não há alterações registadas neste período')).toBeInTheDocument()
	})
})

describe('API down → error state, and "Tentar de novo" really retries', () => {
	test.each([
		['/', '/api/warnings', 'Não foi possível carregar os avisos'],
		['/cronologia', '/api/warnings', 'Não foi possível carregar os avisos'],
		['/distrito/lisboa', '/api/warnings', 'Não foi possível carregar os avisos'],
		['/historico', '/api/warnings/history', 'O histórico ainda não está disponível'],
		['/estacoes', '/api/stations', 'Não foi possível carregar as estações'],
		[`/estacao/${STATION_ID}-lisboa-geofisico`, '/api/stations', 'Não foi possível carregar as estações'],
	])('%s with %s failing', async (path, api, message) => {
		const { calls } = mockApi({ overrides: { [api]: 502 } })
		const view = renderRoute(path)
		const heading = await screen.findByRole('heading', { name: message })
		expect(heading).toBeInTheDocument()
		const before = calls.filter((c) => c.startsWith(api)).length
		await view.user.click(screen.getByRole('button', { name: /Tentar de novo/ }))
		await waitFor(() => expect(calls.filter((c) => c.startsWith(api)).length).toBeGreaterThan(before))
	})
	test('the station page survives a warnings failure (banner only)', async () => {
		mockApi({ overrides: { '/api/warnings': 502 } })
		renderRoute(`/estacao/${STATION_ID}-lisboa-geofisico`)
		await h1('Lisboa (Geofísico)')
	})
	test('enrichment failures (stations/observations) never break the index', async () => {
		mockApi({ overrides: { '/api/stations': 502, '/api/observations': 502 } })
		renderRoute('/')
		expect(await screen.findAllByRole('link', { name: /Lisboa/ })).not.toHaveLength(0)
	})
	test('station series endpoint down → falls back to the 24 h slice', async () => {
		const { calls } = mockApi({ overrides: { [`/api/stations/${STATION_ID}/observations`]: 502 } })
		renderRoute(`/estacao/${STATION_ID}-lisboa-geofisico`)
		await h1('Lisboa (Geofísico)')
		await waitFor(() => expect(calls.some((c) => c.startsWith('/api/observations/recent?stations='))).toBe(true))
	})
})

describe('bad query parameters fall back to defaults', () => {
	test.each([
		'/cronologia?d=XXX',
		'/estacoes?ordem=lixo&dir=lado&regiao=marte&q=%E0%A4',
		'/historico?periodo=lixo&regiao=xpto&tipo=granizo&evento=nada&de=ontem',
		'/criterios?regiao=lua',
	])('%s', async (path) => {
		mockApi()
		renderRoute(path)
		expect(await screen.findByRole('heading', { level: 1 }, { timeout: 3000 })).toBeInTheDocument()
		await waitFor(() => expect(document.querySelector('.fa-spin')).toBeNull(), { timeout: 3000 })
		expect(screen.queryByText(/Não foi possível/)).not.toBeInTheDocument()
	})
})
