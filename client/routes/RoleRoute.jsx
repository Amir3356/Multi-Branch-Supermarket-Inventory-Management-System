import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { canOpen, homePathFor } from './paths'

// A page the user's role can't open sends them to their own home page instead
export default function RoleRoute({ section, children }) {
  const user = useSelector(selectCurrentUser)
  if (!canOpen(user, section)) return <Navigate to={homePathFor(user)} replace />
  return children
}
