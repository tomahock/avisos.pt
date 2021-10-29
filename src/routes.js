import React, { Component } from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import IndexPage from './pages'

class App extends Component {
	render() {
		return (
			<Router basename={process.env.PUBLIC_URL}>
				<Switch>
					<Route exact path="/" component={IndexPage} />
				</Switch>
			</Router>
		)
	}
}

export default App
