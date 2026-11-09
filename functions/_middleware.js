// Server-side <head> for every HTML page.
//
// The app is a client-rendered SPA, but Facebook/WhatsApp/X/LinkedIn preview
// bots never run JS — they only see the static index.html. This middleware
// rewrites title, description, canonical, robots, Open Graph, Twitter and
// JSON-LD per route before the HTML leaves the edge, so every URL (district,
// individual warning, static pages) previews with its own text and card.
//
// It must never break page delivery: any failure (no API key, FogosPT down)
// falls back to generic meta for that route.

import { IPMA_AREAS, codeFromSlug } from '../src/data/ipmaAreas.js'
import {
	DEFAULT_META as DEFAULT,
	PAGE_META as STATIC_PAGES,
	SITE_NAME,
	SITE_URL,
	districtSeo,
	findWarning,
	warningSeo,
	warningSlug,
	warningsVersion,
	areaWarnings,
} from '../src/utils/share.js'
import { getLatestObservations, getStations, getWarnings } from './_warnings.js'
import { stationIdFromSlug, stationRows, stationSeo } from '../src/utils/stations.js'

function siteTitle(title) {
	return title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`
}

async function metaFor(url, env, waitUntil) {
	const path = url.pathname.replace(/\/+$/, '') || '/'

	if (path === '/') {
		let version = ''
		try {
			version = warningsVersion(await getWarnings(env, waitUntil))
		} catch {
			// generic card
		}
		return {
			...DEFAULT,
			path: '/',
			image: `/og/site.png${version ? `?v=${version}` : ''}`,
			imageAlt: 'Mapa resumo dos avisos meteorológicos em vigor por distrito',
		}
	}

	if (STATIC_PAGES[path]) {
		return {
			...STATIC_PAGES[path],
			title: siteTitle(STATIC_PAGES[path].title),
			path,
			image: '/og/site.png',
			imageAlt: SITE_NAME,
		}
	}

	const st = path.match(/^\/estacao\/([a-z0-9-]+)$/)
	if (st) return stationMeta(st[1], path, env, waitUntil)

	const m = path.match(/^\/distrito\/([a-z0-9-]+)(?:\/aviso\/([a-z0-9-]+))?$/)
	if (!m) return { ...DEFAULT, path, robots: 'noindex, follow', status: 404 }

	const code = codeFromSlug(m[1])
	if (!code) {
		return { ...DEFAULT, title: siteTitle('Distrito não encontrado'), path, robots: 'noindex, follow', status: 404 }
	}
	const name = IPMA_AREAS[code].name

	let warnings = null
	try {
		warnings = await getWarnings(env, waitUntil)
	} catch (err) {
		console.error('[seo] warnings unavailable:', err.message)
	}

	const breadcrumb = [
		{ name: SITE_NAME, path: '/' },
		{ name, path: `/distrito/${m[1]}` },
	]

	if (!m[2]) {
		const seo = districtSeo(code, warnings)
		const v = warnings ? warningsVersion(areaWarnings(warnings, code)) : ''
		return {
			title: siteTitle(seo.title),
			description: seo.description,
			path: seo.path,
			image: `/og/distrito/${m[1]}.png${v ? `?v=${v}` : ''}`,
			imageAlt: `Avisos meteorológicos para ${name}`,
			breadcrumb,
		}
	}

	const w = warnings ? findWarning(warnings, code, m[2]) : null
	// Warnings expire and FogosPT drops them — the URL keeps working (the
	// page says it ended) but must not be indexed as content.
	if (!w) {
		return {
			title: siteTitle(`Aviso terminado — ${name}`),
			description: `Este aviso meteorológico para ${name} já terminou ou foi atualizado. Consulte os avisos em vigor.`,
			path,
			image: `/og/distrito/${m[1]}.png`,
			imageAlt: `Avisos meteorológicos para ${name}`,
			robots: 'noindex, follow',
			breadcrumb,
		}
	}
	const seo = warningSeo(w)
	return {
		title: siteTitle(seo.title),
		description: seo.description,
		path: seo.path,
		image: `/og/aviso/${m[1]}/${warningSlug(w)}.png?v=${warningsVersion([w])}`,
		imageAlt: seo.title,
		robots: 'noindex, follow',
		breadcrumb: [...breadcrumb, { name: seo.title, path: seo.path }],
	}
}

async function stationMeta(slug, path, env, waitUntil) {
	const id = stationIdFromSlug(slug)
	const notFound = {
		...DEFAULT,
		title: siteTitle('Estação não encontrada'),
		path,
		robots: 'noindex, follow',
		status: 404,
	}
	if (id == null) return notFound

	let catalog
	try {
		catalog = await getStations(env, waitUntil)
	} catch (err) {
		console.error('[seo] stations unavailable:', err.message)
		return { ...STATIC_PAGES['/estacoes'], title: siteTitle('Estação meteorológica'), path, image: '/og/site.png' }
	}
	const feature = catalog.find((f) => f?.properties?.idEstacao === id)
	if (!feature) return notFound

	let latest = { hour: null, stations: {} }
	try {
		latest = await getLatestObservations(env, waitUntil)
	} catch (err) {
		console.error('[seo] observations unavailable:', err.message)
	}
	const [row] = stationRows([feature], latest.stations)
	const seo = stationSeo(row, latest.hour)
	const breadcrumb = [
		{ name: SITE_NAME, path: '/' },
		{ name: 'Estações', path: '/estacoes' },
		...(row.area ? [{ name: IPMA_AREAS[row.area].name, path: `/distrito/${IPMA_AREAS[row.area].slug}` }] : []),
		{ name: row.name, path: seo.path },
	]
	return {
		title: siteTitle(seo.title),
		description: seo.description,
		path: seo.path,
		image: `/og/estacao/${id}.png?v=${warningsVersion([{ startTime: latest.hour ?? '', text: JSON.stringify(row.obs ?? {}) }])}`,
		imageAlt: `Condições atuais na estação ${row.name}`,
		breadcrumb,
	}
}

function escAttr(s) {
	return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function jsonLd(meta) {
	if (!meta.breadcrumb) return ''
	const data = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: meta.breadcrumb.map((b, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: b.name,
			item: SITE_URL + b.path,
		})),
	}
	// </script> can't appear inside JSON-LD; escape the slash defensively.
	return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

function setContent(value) {
	return { element: (el) => el.setAttribute('content', value) }
}

function rewrite(res, meta) {
	const url = SITE_URL + meta.path
	const image = SITE_URL + (meta.image ?? '/og/site.png')
	const robots = meta.robots ?? 'index, follow'

	return new HTMLRewriter()
		.on('title', { element: (el) => el.setInnerContent(meta.title) })
		.on('meta[name="description"]', setContent(meta.description))
		.on('meta[name="robots"]', setContent(robots))
		.on('link[rel="canonical"]', { element: (el) => el.setAttribute('href', url) })
		.on('meta[property="og:url"]', setContent(url))
		.on('meta[property="og:title"]', setContent(meta.title))
		.on('meta[property="og:description"]', setContent(meta.description))
		.on('meta[property="og:image"]', setContent(image))
		.on('meta[name="twitter:url"]', setContent(url))
		.on('meta[name="twitter:title"]', setContent(meta.title))
		.on('meta[name="twitter:description"]', setContent(meta.description))
		.on('meta[name="twitter:image"]', setContent(image))
		.on('head', {
			element: (el) =>
				el.append(
					`<meta property="og:image:width" content="1200" />` +
						`<meta property="og:image:height" content="630" />` +
						`<meta property="og:image:type" content="image/png" />` +
						`<meta property="og:image:alt" content="${escAttr(meta.imageAlt ?? meta.title)}" />` +
						`<meta name="twitter:image:alt" content="${escAttr(meta.imageAlt ?? meta.title)}" />` +
						jsonLd(meta),
					{ html: true }
				),
		})
		.transform(res)
}

export async function onRequest(context) {
	const { request, next, env } = context
	const url = new URL(request.url)

	if (
		request.method !== 'GET' ||
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/og/') ||
		/\.[a-z0-9]+$/i.test(url.pathname)
	) {
		return next()
	}

	const res = await next()
	if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res

	let meta
	try {
		meta = await metaFor(url, env, context.waitUntil.bind(context))
	} catch (err) {
		console.error('[seo] meta failed:', err)
		return res
	}

	const out = rewrite(res, meta)
	if (!meta.status) return out
	return new Response(out.body, { status: meta.status, headers: out.headers })
}
