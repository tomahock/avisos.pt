export default function StateEmpty() {
	return (
		<div className="mt-16 px-6 text-center">
			<div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
				<i className="fas fa-check text-3xl text-green-600" aria-hidden />
			</div>
			<h2 className="mt-6 text-3xl font-bold text-gray-900 tracking-tight">
				Sem avisos meteorológicos
			</h2>
			<p className="mt-2 text-gray-500">
				Não há nenhum aviso em vigor para Portugal continental neste momento.
			</p>
		</div>
	)
}
