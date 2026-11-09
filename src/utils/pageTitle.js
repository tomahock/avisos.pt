import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { SITE_URL } from './share.js'

const DEFAULT = 'Avisos.pt — Avisos meteorológicos em vigor em Portugal'

function setMeta(selector, attr, value) {
	if (value == null) return
	const el = document.head.querySelector(selector)
	if (el) el.setAttribute(attr, value)
}

// Keeps <head> in sync on client-side navigation. The first paint of every
// URL already comes with the right tags from functions/_middleware.js; this
// only matters for crawlers that render JS (Google) after in-app navigation.
// `description` is optional — pages without one leave the server's value.
export function usePageTitle(title, { description, robots } = {}) {
	const { pathname } = useLocation()

	useEffect(() => {
		const fullTitle = title || DEFAULT
		const url = SITE_URL + pathname
		document.title = fullTitle
		setMeta('link[rel="canonical"]', 'href', url)
		setMeta('meta[property="og:url"]', 'content', url)
		setMeta('meta[property="og:title"]', 'content', fullTitle)
		setMeta('meta[name="twitter:title"]', 'content', fullTitle)
		setMeta('meta[name="description"]', 'content', description)
		setMeta('meta[property="og:description"]', 'content', description)
		setMeta('meta[name="twitter:description"]', 'content', description)
		setMeta('meta[name="robots"]', 'content', robots ?? 'index, follow')
	}, [title, description, robots, pathname])
}
