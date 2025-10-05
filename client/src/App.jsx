import { Provider } from 'react-redux'
import { store } from './redux/store'
import AppRouter from './routes/AppRouter'

// App shell: the Redux store around the router
export default function App() {
  return (
    <Provider store={store}>
      <AppRouter />
    </Provider>
  )
}
