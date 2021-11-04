import React from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

function Header({ title = 'Avisos.pt' }) {
	return (
		<header className="relative py-6">
			<div className="w-full px-2 mx-auto">
				<div className="relative flex items-center justify-between">
					<h1 className="m-0 text-xl font-bold leading-none uppercase">
						<Link to="/" className="flex items-center no-underline">
							<img className="max-h-10" src="/imgs/logo.png" alt="Avisos.pt" />
							{title}
						</Link>
					</h1>
				</div>
			</div>
		</header>
	)
}

export default Header
