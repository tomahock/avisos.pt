// Server-side <head> from functions/_middleware.js (share bots don't run JS)
// and real 404s. Plain HTTP, no browser.

import { expect, test } from '@playwright/test'

import { warningPath } from './helpers.js'

const head = async (request, path) => {
	const res = await request.get(path)
	const html = await res.text()
	const meta = (attr, key) => html.match(new RegExp(`<meta[^>]+${attr}="${key}"[^>]+content="([^"]*)"`))?.[1] ?? null
	return {
		status: res.status(),
		title: html.match(/<title>([^<]*)<\/title>/)?.[1],
		description: meta('name', 'description'),
		robots: meta('name', 'robots'),
		canonical: html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/)?.[1],
		ogImage: meta('property', 'og:image'),
		ogTitle: meta('property', 'og:title'),
		jsonLd: [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1])),
	}
}

test.describe.configure({ mode: 'parallel' })

for (const [path, title] of [
	['/', 'Avisos.pt — Avisos meteorológicos em vigor em Portugal'],
	['/cronologia', 'Cronologia dos avisos meteorológicos, hora a hora · Avisos.pt'],
	['/historico', 'Histórico de avisos meteorológicos — agravamentos e desagravamentos · Avisos.pt'],
	['/mapa', 'Mapa dos avisos meteorológicos em Portugal · Avisos.pt'],
	['/estacoes', 'Estações meteorológicas IPMA — temperatura, vento e chuva agora · Avisos.pt'],
	['/criterios', 'Critérios de emissão de avisos meteorológicos do IPMA · Avisos.pt'],
]) {
	test(`static page ${path}`, async ({ request }) => {
		const h = await head(request, path)
		expect(h.status).toBe(200)
		expect(h.title).toBe(title)
		expect(h.canonical).toBe(`https://avisos.pt${path === '/' ? '/' : path}`)
		expect(h.robots ?? 'index, follow').toMatch(/^index/)
		expect(h.description?.length).toBeGreaterThan(50)
		expect(h.ogImage).toMatch(/^https:\/\/avisos\.pt\/og\/site\.png/)
	})
}

test('district page carries its warnings in the description and its own card', async ({ request }) => {
	const h = await head(request, '/distrito/lisboa')
	expect(h.status).toBe(200)
	expect(h.title).toBe('Avisos meteorológicos para Lisboa · Avisos.pt')
	expect(h.description).toMatch(/laranja de Vento/)
	expect(h.canonical).toBe('https://avisos.pt/distrito/lisboa')
	expect(h.ogImage).toMatch(/\/og\/distrito\/lisboa\.png\?v=[0-9a-z]+$/)
	expect(h.jsonLd.some((j) => j['@type'] === 'BreadcrumbList')).toBe(true)
})

test('warning page is noindex (warnings expire) with its own card', async ({ request }) => {
	const { path } = await warningPath(request)
	const h = await head(request, path)
	expect(h.status).toBe(200)
	expect(h.title).toMatch(/^Aviso laranja de Vento — Lisboa · Avisos\.pt$/)
	expect(h.robots).toMatch(/noindex/)
	expect(h.ogImage).toMatch(/\/og\/aviso\/lisboa\//)
})

test('station page: reading in the description; old slug → current canonical', async ({ request }) => {
	const h = await head(request, '/estacao/1200535-nome-antigo')
	expect(h.status).toBe(200)
	expect(h.title).toBe('Lisboa (Geofísico) — estação meteorológica IPMA · Avisos.pt')
	expect(h.canonical).toBe('https://avisos.pt/estacao/1200535-lisboa-geofisico')
	expect(h.description).toMatch(/°C/)
})

for (const path of ['/xpto', '/distrito/atlantida', '/distrito/lisboa/xpto', '/estacao/123-nada', '/estacao/nada', '/sitemap.xlm', '/imgs/nada.png']) {
	test(`real 404: ${path}`, async ({ request }) => {
		const h = await head(request, path)
		expect(h.status).toBe(404)
		if (!/\.(png|xlm)$/.test(path)) expect(h.robots).toMatch(/noindex/)
	})
}

test('unknown /api route is a JSON 404', async ({ request }) => {
	const res = await request.get('/api/nope')
	expect(res.status()).toBe(404)
	expect(await res.json()).toEqual({ error: 'not_found' })
})

test('robots.txt, sitemap.xml and manifest.json', async ({ request }) => {
	const robots = await (await request.get('/robots.txt')).text()
	expect(robots).toMatch(/Disallow: \/api\//)
	expect(robots).toMatch(/Sitemap: https:\/\/avisos\.pt\/sitemap\.xml/)
	const sitemap = await (await request.get('/sitemap.xml')).text()
	expect(sitemap.match(/<loc>https:\/\/avisos\.pt\/distrito\/[^<]+<\/loc>/g)).toHaveLength(25)
	for (const p of ['/', '/cronologia', '/historico', '/mapa', '/estacoes', '/criterios']) expect(sitemap).toContain(`<loc>https://avisos.pt${p}</loc>`)
	const manifest = await (await request.get('/manifest.json')).json()
	expect(manifest.name).toMatch(/^Avisos\.pt/)
	for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200)
})
