export async function fetchJson(url, signal) {
	const res = await fetch(url, { signal })
	if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
	return res.json()
}
