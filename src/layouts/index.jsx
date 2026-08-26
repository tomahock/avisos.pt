import Header from '../components/layout/Header.jsx'
import Footer from '../components/layout/Footer.jsx'

export default function Layout({ children }) {
	return (
		<div className="relative overflow-hidden bg-gray-100 p-8">
			<div className="flex flex-col min-h-screen mx-auto my-0 overflow-hidden bg-white shadow-2xl max-w-screen-2xl">
				<Header />
				<main className="mb-auto">{children}</main>
				<Footer />
			</div>
		</div>
	)
}
