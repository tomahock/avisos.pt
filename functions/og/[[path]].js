// Share cards (1200×630 PNG) for social previews:
//   /og/site.png                         — national overview
//   /og/distrito/<slug>.png              — one district/region
//   /og/aviso/<slug>/<warning-id>.png    — one warning
//   /og/estacao/<id>.png                 — one weather station (current reading)
//
// Rendered with satori/resvg (workers-og) from an HTML string. Satori rules:
// every <div> with more than one child needs display:flex, and there are no
// icon fonts — level colour and text carry the meaning. The font is the
// latin subset: no arrows (→ renders as tofu), use – instead.
// The ?v= query the middleware appends only busts social caches; the image is
// always built from the current warnings.

import { ImageResponse } from 'workers-og'

import { CONTINENTAL_CODES, IPMA_AREAS, codeFromSlug } from '../../src/data/ipmaAreas.js'
import { LEVELS, worstLevelId } from '../../src/data/levels.js'
import {
	areaWarnings,
	findWarning,
	formatLisbon,
	formatLisbonInstant,
	formatRange,
	levelLabel,
} from '../../src/utils/share.js'
import { getLatestObservations, getStations, getWarnings } from '../_warnings.js'
import { fmtKmh, fmtMm, fmtPct, fmtTemp, obsDate, reading, stationRows, windDir } from '../../src/utils/stations.js'

const W = 1200
const H = 630
const CACHE_SECONDS = 600

const INK = '#0f172a'
const MUTED = '#64748b'
const NONE = '#cbd5e1'

// Text colour on top of each level fill (yellow needs dark text).
const ON = { yellow: INK, orange: '#ffffff', red: '#ffffff' }

let fontsPromise
function loadFonts() {
	// Module-scope promise: one download per isolate, not per request.
	fontsPromise ??= Promise.all(
		[400, 700].map(async (weight) => {
			const res = await fetch(
				`https://cdn.jsdelivr.net/npm/@fontsource/fira-sans@5/files/fira-sans-latin-${weight}-normal.woff`,
				{ cf: { cacheTtl: 86400 * 30, cacheEverything: true } }
			)
			if (!res.ok) throw new Error(`font ${weight}: ${res.status}`)
			return { name: 'Fira Sans', data: await res.arrayBuffer(), weight, style: 'normal' }
		})
	).catch((err) => {
		fontsPromise = undefined
		throw err
	})
	return fontsPromise
}

function esc(s) {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function truncate(s, n) {
	s = String(s ?? '')
	return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s
}

function fill(level) {
	return LEVELS[level]?.fill && level !== 'green' ? LEVELS[level].fill : NONE
}

function pill(level, text) {
	const bg = fill(level)
	const fg = ON[level] ?? INK
	return `<div style="display:flex;align-self:flex-start;background:${bg};color:${fg};font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:10px 22px;border-radius:12px">${esc(text)}</div>`
}

function frame(level, body) {
	const now = formatLisbonInstant(Date.now())
	return `
	<div style="display:flex;width:${W}px;height:${H}px;background:#ffffff;font-family:'Fira Sans';color:${INK}">
		<div style="display:flex;width:28px;height:${H}px;background:${fill(level)}"></div>
		<div style="display:flex;flex-direction:column;flex:1;padding:52px 64px 44px 60px">
			<div style="display:flex;align-items:center;justify-content:space-between;font-size:26px;color:${MUTED}">
				<div style="display:flex;flex:1;font-weight:700;color:${INK};font-size:30px">avisos.pt</div>
				<div style="display:flex">Avisos meteorológicos · IPMA</div>
			</div>
			<div style="display:flex;flex-direction:column;flex:1;margin-top:34px">${body}</div>
			<div style="display:flex;font-size:22px;color:${MUTED}">Atualizado ${esc(now)} · hora de Lisboa</div>
		</div>
	</div>`
}

function warningRows(list, max) {
	const sorted = [...list].sort(
		(a, b) => (LEVELS[b.awarenessLevelID]?.priority ?? 0) - (LEVELS[a.awarenessLevelID]?.priority ?? 0)
	)
	const rows = sorted.slice(0, max).map(
		(w) => `
		<div style="display:flex;align-items:center;margin-top:16px;font-size:32px">
			<div style="display:flex;width:26px;height:26px;border-radius:7px;background:${fill(w.awarenessLevelID)};margin-right:18px"></div>
			<div style="display:flex;font-weight:700;margin-right:16px">${esc(w.awarenessTypeName)}</div>
			<div style="display:flex;color:${MUTED}">até ${esc(formatLisbon(w.endTime))}</div>
		</div>`
	)
	if (sorted.length > max) {
		rows.push(`<div style="display:flex;margin-top:16px;font-size:28px;color:${MUTED}">+ ${sorted.length - max} outros avisos</div>`)
	}
	return rows.join('')
}

function districtCard(code, warnings) {
	const list = areaWarnings(warnings, code)
	const worst = worstLevelId(list)
	const name = IPMA_AREAS[code].name
	const body = list.length
		? `${pill(worst, `Aviso ${levelLabel(worst)}`)}
		   <div style="display:flex;font-size:76px;font-weight:700;line-height:1.05;margin-top:24px">${esc(name)}</div>
		   <div style="display:flex;flex-direction:column;margin-top:14px">${warningRows(list, 3)}</div>`
		: `${pill(null, 'Sem avisos')}
		   <div style="display:flex;font-size:76px;font-weight:700;line-height:1.05;margin-top:24px">${esc(name)}</div>
		   <div style="display:flex;font-size:34px;color:${MUTED};margin-top:24px">Sem avisos meteorológicos neste momento.</div>`
	return frame(worst, body)
}

function warningCard(w) {
	const name = IPMA_AREAS[w.idAreaAviso]?.name ?? w.idAreaAviso
	const body = `
		${pill(w.awarenessLevelID, `Aviso ${levelLabel(w.awarenessLevelID)}`)}
		<div style="display:flex;font-size:72px;font-weight:700;line-height:1.05;margin-top:24px">${esc(w.awarenessTypeName)}</div>
		<div style="display:flex;font-size:40px;color:${MUTED};margin-top:8px">${esc(name)}</div>
		<div style="display:flex;font-size:36px;font-weight:700;margin-top:28px">${esc(formatRange(w, '–'))}</div>
		<div style="display:flex;font-size:28px;color:#334155;margin-top:16px;line-height:1.35">${esc(truncate(w.text, 150))}</div>`
	return frame(w.awarenessLevelID, body)
}

function siteCard(warnings) {
	const worstAll = worstLevelId(warnings ?? [])
	const chips = CONTINENTAL_CODES.map((code) => {
		const worst = warnings ? worstLevelId(areaWarnings(warnings, code)) : null
		const bg = worst ? fill(worst) : '#f1f5f9'
		const fg = worst ? ON[worst] : MUTED
		return `<div style="display:flex;justify-content:center;width:186px;margin:0 10px 10px 0;padding:10px 0;border-radius:10px;background:${bg};color:${fg};font-size:21px;font-weight:700">${esc(IPMA_AREAS[code].name)}</div>`
	}).join('')
	const active = warnings ? new Set(warnings.map((w) => w.idAreaAviso)).size : 0
	const body = `
		<div style="display:flex;font-size:64px;font-weight:700;line-height:1.05">Avisos meteorológicos em Portugal</div>
		<div style="display:flex;font-size:30px;color:${MUTED};margin-top:10px">${
			warnings ? (active ? `${active} ${active === 1 ? 'região' : 'regiões'} com aviso em vigor ou previsto` : 'Sem avisos neste momento') : 'Em tempo real, por distrito'
		}</div>
		<div style="display:flex;flex-wrap:wrap;margin-top:28px">${chips}</div>`
	return frame(worstAll, body)
}

function stationCard(row, hour, warnings) {
	const area = row.area ? IPMA_AREAS[row.area] : null
	const worst = warnings && row.area ? worstLevelId(areaWarnings(warnings, row.area)) : null
	const o = row.obs
	const temp = fmtTemp(reading(o, 'temperatura'))
	const wind = reading(o, 'intensidadeVentoKM')
	const stats = [
		['Vento', wind != null ? `${fmtKmh(wind)}${windDir(reading(o, 'idDireccVento')) ? ` ${windDir(reading(o, 'idDireccVento'))}` : ''}` : null],
		['Chuva 1 h', fmtMm(reading(o, 'precAcumulada'))],
		['Humidade', fmtPct(reading(o, 'humidade'))],
	].filter(([, v]) => v)
	const when = obsDate(hour)
	const body = `
		<div style="display:flex;font-size:26px;color:${MUTED}">Estação meteorológica IPMA${area ? ` · ${esc(area.name)}` : ''}</div>
		<div style="display:flex;font-size:60px;font-weight:700;line-height:1.05;margin-top:8px">${esc(truncate(row.name, 34))}</div>
		<div style="display:flex;align-items:flex-end;margin-top:26px">
			<div style="display:flex;font-size:132px;font-weight:700;line-height:1">${esc(temp ?? '—')}</div>
			<div style="display:flex;flex-direction:column;margin-left:56px;margin-bottom:10px">
				${stats
					.map(
						([k, v]) =>
							`<div style="display:flex;font-size:32px;margin-top:8px"><div style="display:flex;color:${MUTED};width:190px">${esc(k)}</div><div style="display:flex;font-weight:700">${esc(v)}</div></div>`
					)
					.join('')}
			</div>
		</div>
		<div style="display:flex;font-size:26px;color:${MUTED};margin-top:22px">${
			o && when ? `Leitura das ${esc(formatLisbonInstant(when.getTime()))}` : 'Sem leitura na última hora'
		}</div>`
	return frame(worst, body)
}

function notFound() {
	return new Response('Not found', { status: 404 })
}

export async function onRequestGet(context) {
	const { request, env, params } = context
	const parts = Array.isArray(params.path) ? params.path : [params.path]

	const cache = caches.default
	const cacheKey = new Request(request.url, { method: 'GET' })
	const hit = await cache.match(cacheKey)
	if (hit) return hit

	let warnings = null
	try {
		warnings = await getWarnings(env, context.waitUntil.bind(context))
	} catch (err) {
		console.error('[og] warnings unavailable:', err.message)
	}

	let html
	const last = (parts.at(-1) ?? '').replace(/\.png$/, '')
	if (parts.length === 1 && last === 'site') {
		html = siteCard(warnings)
	} else if (parts.length === 2 && parts[0] === 'distrito') {
		const code = codeFromSlug(last)
		if (!code) return notFound()
		html = warnings ? districtCard(code, warnings) : siteCard(null)
	} else if (parts.length === 3 && parts[0] === 'aviso') {
		const code = codeFromSlug(parts[1])
		if (!code) return notFound()
		const w = warnings ? findWarning(warnings, code, last) : null
		html = w ? warningCard(w) : warnings ? districtCard(code, warnings) : siteCard(null)
	} else if (parts.length === 2 && parts[0] === 'estacao') {
		const id = Number(last)
		if (!Number.isInteger(id)) return notFound()
		let catalog
		try {
			catalog = await getStations(env, context.waitUntil.bind(context))
		} catch {
			catalog = null
		}
		const feature = catalog?.find((f) => f?.properties?.idEstacao === id)
		if (catalog && !feature) return notFound()
		if (!feature) {
			html = siteCard(warnings)
		} else {
			let latest = { hour: null, stations: {} }
			try {
				latest = await getLatestObservations(env, context.waitUntil.bind(context))
			} catch {
				// card without readings
			}
			html = stationCard(stationRows([feature], latest.stations)[0], latest.hour, warnings)
		}
	} else {
		return notFound()
	}

	let fonts
	try {
		fonts = await loadFonts()
	} catch (err) {
		console.error('[og] fonts:', err.message)
		return Response.redirect(new URL('/imgs/logo.png', request.url).toString(), 302)
	}

	const img = new ImageResponse(html, { width: W, height: H, fonts })
	const body = await img.arrayBuffer()
	const res = new Response(body, {
		headers: {
			'content-type': 'image/png',
			// Without warnings we rendered a generic card — don't pin it.
			'cache-control': `public, max-age=${warnings ? CACHE_SECONDS : 60}`,
		},
	})
	if (warnings) context.waitUntil(cache.put(cacheKey, res.clone()))
	return res
}
