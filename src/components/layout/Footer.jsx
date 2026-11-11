// Site-wide footer: data credits, open-source/contribution invite and the
// attribution required by NOTICE (AGPL-3.0 §7(b)). Forks must keep the
// "Baseado no Avisos.pt" line.

const REPO = 'https://github.com/tomahock/avisos.pt'

function A({ href, children }) {
	return (
		<a href={href} target="_blank" rel="noreferrer" className="text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900 hover:decoration-gray-500">
			{children}
		</a>
	)
}

export default function Footer() {
	return (
		<footer className="mt-10 border-t border-gray-100 px-6 py-6 text-xs leading-relaxed text-gray-500">
			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="space-y-1 max-w-2xl">
					<p className="m-0">
						<span className="font-semibold text-gray-700">Dados:</span> avisos meteorológicos e estações do{' '}
						<A href="https://www.ipma.pt">IPMA</A>; ocorrências da <A href="https://www.prociv.gov.pt">ANEPC</A> e, na Madeira, do{' '}
						<A href="https://www.procivmadeira.pt">SRPC, IP-RAM</A>; através da <A href="https://fogos.pt/pt/api">API do Fogos.pt</A>.
						Localização aproximada das ocorrências da Madeira pelo centroide da freguesia (CAOP,{' '}
						<A href="https://www.dgterritorio.gov.pt">DGT</A>, via Fogos.pt).
						Limites dos concelhos de{' '}
						<A href="https://github.com/FrancisPais/geojson-portugal-continental">FrancisPais/geojson-portugal</A>. Mapa
						© contribuidores do <A href="https://www.openstreetmap.org/copyright">OpenStreetMap</A>.
					</p>
					<p className="m-0">
						Em caso de dúvida prevalece a informação oficial do <A href="https://www.ipma.pt/pt/otempo/prev-sam/">IPMA</A>; siga
						as recomendações da <A href="https://www.prociv.gov.pt">ANEPC</A>.
					</p>
				</div>

				<div className="shrink-0 space-y-2 md:text-right">
					<a
						href={REPO}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-surface px-3 py-1.5 text-xs font-semibold text-gray-800 no-underline hover:border-gray-300 hover:bg-gray-50"
					>
						<i className="fab fa-github text-sm" aria-hidden />
						Código aberto — contribua no GitHub
					</a>
					<p className="m-0">
						<A href={`${REPO}/blob/main/LICENSE`}>AGPL-3.0</A> · <A href={`${REPO}/issues`}>Reportar um problema</A>
					</p>
				</div>
			</div>

			<p className="mt-4 m-0 text-gray-400">
				© 2021–2026 Baseado no <A href="https://avisos.pt">Avisos.pt</A>, por <A href="https://github.com/tomahock">Tomahock</A>{' '}
				(<A href={REPO}>github.com/tomahock/avisos.pt</A>) · com a <A href="https://vost.pt">VOST Portugal</A> ·{' '}
				<A href="https://vost.pt/avisos-meteorologicos/">Saber mais</A>
			</p>
		</footer>
	)
}
