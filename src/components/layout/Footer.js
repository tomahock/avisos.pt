import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
	return (
		<footer className="text-sm leading-5 tracking-normal text-gray-400 mt-6">
			<div className="flex p-2">
				<p className="text-right w-full">
					&copy; 2021 Made with 💗 by
					<a
						href="https://twitter.com/tomahock"
						className="no-underline"
						target="_blank"
						rel="noreferrer"
					>
						&nbsp;Tomahock
					</a>
					&nbsp;| Powered by
					<a
						href="https://twitter.com/vostpt"
						className="no-underline"
						target="_blank"
						rel="noreferrer"
					>
						&nbsp;VostPT
					</a>
					&nbsp;| Data from
					<a
						href="https://www.ipma.pt/pt/otempo/prev-sam/"
						className="no-underline"
						target="_blank"
						rel="noreferrer"
					>
						&nbsp;IPMA
					</a>
					&nbsp;|
					<a
						href="https://vost.pt/avisos-meteorologicos/"
						className="no-underline"
						target="_blank"
						rel="noreferrer"
					>
						&nbsp;Read more
					</a>
				</p>
			</div>
		</footer>
	)
}
