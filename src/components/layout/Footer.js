import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
	return (
		<footer className="text-sm leading-5 tracking-normal text-gray-400">
			<div className="w-full max-w-6xl px-6 mx-auto">
				<div className="relative flex flex-wrap py-10 lg:justify-between">
					<div className="inline-flex justify-center flex-none w-full mb-6 lg:w-1/2 lg:justify-start">
						&copy; 2021 Made with 💗 by
						<a
							href="https://twitter.com/tomahock"
							className="flex items-center no-underline"
							target="_blank"
							rel="noreferrer"
						>
							Tomahock
						</a>
						Powered by
						<a
							href="https://twitter.com/vostpt"
							className="flex items-center no-underline"
							target="_blank"
							rel="noreferrer"
						>
							VostPT
						</a>
					</div>
				</div>
			</div>
		</footer>
	)
}
