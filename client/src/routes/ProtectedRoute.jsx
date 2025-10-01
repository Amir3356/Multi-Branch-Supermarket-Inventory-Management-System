import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectAuth } from '../features/auth/authSlice'
import { PATHS } from './paths'

// Dashboard pages need a signed-in user; otherwise go to the login page
export default function ProtectedRoute() {
  const { isLoggedIn } = useSelector(selectAuth)
  const location = useLocation()
  if (!isLoggedIn) return <Navigate to={PATHS.login} replace state={{ from: location.pathname }} />
  return <Outlet />
}
