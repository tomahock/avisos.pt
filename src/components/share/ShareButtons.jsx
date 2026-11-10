import { useEffect, useState } from 'react'

import { SITE_URL } from '../../utils/share.js'

// Share row: native share sheet (mobile) + WhatsApp / Facebook / X / copy.
// `path` is site-relative; links always point at the canonical https URL so
// shares from localhost/previews still land on avisos.pt.
export default function ShareButtons({ path, text, compact = false }) {
	const url = SITE_URL + path
	const [copied, setCopied] = useState(false)
	const [canNativeShare, setCanNativeShare] = useState(false)

	useEffect(() => {
		setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
	}, [])

	useEffect(() => {
		if (!copied) return
		const id = setTimeout(() => setCopied(false), 2000)
		return () => clearTimeout(id)
	}, [copied])

	const message = `${text}\n${url}`
	const links = [
		{ key: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp', href: `https://wa.me/?text=${encodeURIComponent(message)}` },
		{ key: 'facebook', label: 'Facebook', icon: 'fab fa-facebook-f', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
		{ key: 'x', label: 'X', icon: 'fab fa-twitter', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
	]

	async function nativeShare() {
		try {
			await navigator.share({ title: text, text, url })
		} catch {
			// user cancelled — nothing to do
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
		} catch {
			window.prompt('Copie o link:', url)
		}
	}

	const base = 'inline-flex items-center justify-center gap-1.5 rounded-md border transition text-xs font-semibold no-underline'
	const btn = `${base} border-gray-200 bg-surface text-gray-700 hover:bg-gray-50 hover:border-gray-300`
	const size = compact ? 'h-8 w-8' : 'h-9 px-3'

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{canNativeShare && (
				<button type="button" onClick={nativeShare} className={`${base} h-9 px-3 bg-gray-900 border-gray-900 text-gray-50 hover:bg-gray-800`}>
					<i className="fas fa-share-nodes" aria-hidden />
					Partilhar
				</button>
			)}
			{links.map((l) => (
				<a
					key={l.key}
					href={l.href}
					target="_blank"
					rel="noopener noreferrer"
					className={`${btn} ${size}`}
					title={`Partilhar no ${l.label}`}
					aria-label={`Partilhar no ${l.label}`}
				>
					<i className={l.icon} aria-hidden />
					{!compact && <span className="hidden sm:inline">{l.label}</span>}
				</a>
			))}
			<button
				type="button"
				onClick={copy}
				className={`${copied ? `${base} bg-surface border-green-300 dark:border-green-700 text-green-700 dark:text-green-400` : btn} ${size}`}
				title="Copiar link"
				aria-label="Copiar link"
			>
				<i className={`fas ${copied ? 'fa-check' : 'fa-link'}`} aria-hidden />
				{!compact && <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar link'}</span>}
			</button>
		</div>
	)
}
