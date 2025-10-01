import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router-dom'
import { selectAuth } from '../features/auth/authSlice'
import { PATHS } from './paths'

// The login page is only for signed-out users
export default function PublicOnlyRoute() {
  const { isLoggedIn } = useSelector(selectAuth)
  if (isLoggedIn) return <Navigate to={PATHS.dashboard} replace />
  return <Outlet />
}
