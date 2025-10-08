import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AuthShell from '../features/auth/AuthShell'
import SubmitButton from '../features/auth/SubmitButton'
import { AuthAlert, PasswordField } from '../features/auth/AuthField'
import { validateNewPassword } from '../features/auth/passwordRules'
import { resetPassword } from '../features/auth/authThunks'
import { PATHS } from '../routes/paths'

// Opened from the reset email: /reset-password?token=…&email=…
export default function ResetPasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(token && email ? null : { type: 'error', text: 'This reset link is incomplete. Open the link from your email again, or request a new one.' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value })
    setErrors({ ...errors, [field]: null })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!token || !email) return
    const newErrors = validateNewPassword(form.password, form.password_confirmation)
    setErrors(newErrors)
    if (Object.keys(newErrors).length) return
    setIsSubmitting(true)
    setAlert(null)
    try {
      const { message } = await dispatch(resetPassword({ token, email, password: form.password, passwordConfirmation: form.password_confirmation }))
      navigate(PATHS.login, { replace: true, state: { notice: message } })
    } catch (err) {
      setErrors(err.fieldErrors || {})
      setAlert({ type: 'error', text: err.message })
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle={email ? `For ${email}` : undefined}>
      <AuthAlert alert={alert} />

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <PasswordField id="password" label="New Password" value={form.password} onChange={update('password')} error={errors.password} autoFocus />
        <PasswordField id="password_confirmation" label="Confirm New Password" value={form.password_confirmation} onChange={update('password_confirmation')} error={errors.password_confirmation} />
        <span className="field-hint">At least 8 characters, with letters and numbers.</span>

        <SubmitButton busy={isSubmitting} busyLabel="Saving...">
          Reset password
        </SubmitButton>

        <Link to={PATHS.forgotPassword} className="forgot-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}>
          <ArrowLeft size={14} /> Request a new link
        </Link>
      </form>
    </AuthShell>
  )
}
