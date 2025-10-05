import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectAuth } from '../features/auth/authSlice'
import { PATHS } from './paths'

// The login page is only for signed-out users; once signed in, return to the page they asked for
export default function PublicOnlyRoute() {
  const { isLoggedIn } = useSelector(selectAuth)
  const location = useLocation()
  if (isLoggedIn) return <Navigate to={location.state?.from || PATHS.dashboard} replace />
  return <Outlet />
}
