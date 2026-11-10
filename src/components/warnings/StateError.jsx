export default function StateError({ message, onRetry, title = 'Não foi possível carregar os avisos' }) {
	return (
		<div className="mt-16 px-6 text-center">
			<div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/60">
				<i className="fas fa-triangle-exclamation text-3xl text-red-600 dark:text-red-400" aria-hidden />
			</div>
			<h2 className="mt-6 text-2xl font-bold text-gray-900 tracking-tight">
				{title}
			</h2>
			{message && <p className="mt-2 text-sm text-gray-500">{message}</p>}
			{onRetry && (
				<button
					type="button"
					onClick={onRetry}
					className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-gray-50 text-sm font-semibold hover:bg-gray-700 transition"
				>
					<i className="fas fa-rotate-right" aria-hidden />
					Tentar de novo
				</button>
			)}
		</div>
	)
}
