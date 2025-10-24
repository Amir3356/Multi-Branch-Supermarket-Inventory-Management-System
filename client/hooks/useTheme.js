import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { selectTheme, toggleTheme } from '../features/ui/store/uiSlice'

// Applies the saved theme to <html> while the dashboard is open; the login page stays dark
export function useTheme() {
  const theme = useSelector(selectTheme)
  const dispatch = useDispatch()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return { theme, toggle: () => dispatch(toggleTheme()) }
}
