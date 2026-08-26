import Header from '../components/layout/Header.jsx'
import Footer from '../components/layout/Footer.jsx'

export default function Layout({ children, updatedAt }) {
	return (
		<div className="relative overflow-hidden bg-gray-100 md:p-8">
			<div className="flex flex-col min-h-screen mx-auto my-0 overflow-hidden bg-white md:shadow-2xl md:rounded max-w-screen-2xl">
				<Header updatedAt={updatedAt} />
				<main className="mb-auto pb-8">{children}</main>
				<Footer />
			</div>
		</div>
	)
}
