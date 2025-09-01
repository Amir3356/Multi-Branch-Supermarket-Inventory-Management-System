import { useState } from 'react'
import Dashboard from './Dashboard.jsx'
import {
  Pill,
  Activity,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  // Validate form fields
  const validateForm = () => {
    const newErrors = {}
    if (!email) {
      newErrors.email = 'Email address is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle Form Submission
  const handleSubmit = (e) => {
    e.preventDefault()
    setStatusMessage(null)

    if (!validateForm()) return

    setIsSubmitting(true)

    // Simulate frontend redirect to dashboard without backend execution
    setTimeout(() => {
      setIsSubmitting(false)
      setIsLoggedIn(true)
    }, 800)
  }

  // If user signed in, show Dashboard
  if (isLoggedIn) {
    return (
      <Dashboard
        userEmail={email}
        onLogout={() => {
          setIsLoggedIn(false)
          setPassword('')
        }}
      />
    )
  }

  return (
    <div className="app-container">
      {/* Background Ambient Orbs */}
      <div className="ambient-orb orb-1"></div>
      <div className="ambient-orb orb-2"></div>
      <div className="ambient-orb orb-3"></div>

      <div className="login-wrapper">
        {/* Left Side Branding Banner */}
        <div className="brand-section">
          <div className="brand-grid-pattern"></div>
          
          <div className="brand-header">
            <div className="brand-logo">
              <div className="logo-icon-wrapper">
                <Pill size={24} />
              </div>
              <span className="logo-text">PharmaCare</span>
            </div>
            <div className="badge-tag">
              <Activity size={14} /> Inventory v2.4 Active
            </div>
          </div>

          <div className="brand-body">
            <h1 className="brand-title">Smart Pharmacy Management System</h1>
            <p className="brand-desc">
              Streamline pharmaceutical inventory, monitor real-time stock levels, tracking batch expirations, and automate prescription workflows seamlessly.
            </p>

            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-icon">
                  <CheckCircle2 size={15} />
                </div>
                <span>Real-Time Medicine & Batch Tracking</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <CheckCircle2 size={15} />
                </div>
                <span>Automated Expiration & Low-Stock Alerts</span>
              </div>
              <div className="feature-item">
                <div className="feature-icon">
                  <CheckCircle2 size={15} />
                </div>
                <span>Audit logs</span>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <span>© 2026 PharmaCare System</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} /> Encrypted Portal
            </span>
          </div>
        </div>

        {/* Right Side Login Form */}
        <div className="form-section">
          <div className="form-header">
            <div className="mobile-logo">
              <div className="logo-icon-wrapper">
                <Pill size={22} />
              </div>
              <span className="logo-text">PharmaCare</span>
            </div>
            
            <h2 className="form-title">Welcome Back</h2>
            <p className="form-subtitle">Sign in to access your pharmacy inventory dashboard</p>
          </div>

          {/* Status Message Notification */}
          {statusMessage && (
            <div className={`alert-box ${statusMessage.type}`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="input-group">
              <label className="input-label" htmlFor="email">
                Email Address
              </label>
              <div className="input-wrapper">
                <div className="input-icon-left">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  className={`input-field ${errors.email ? 'error' : ''}`}
                  placeholder="name@pharmacy.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors({ ...errors, email: null })
                  }}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <div className="error-msg">
                  <AlertCircle size={13} /> {errors.email}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="input-group">
              <label className="input-label" htmlFor="password">
                Password
              </label>
              <div className="input-wrapper">
                <div className="input-icon-left">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`input-field ${errors.password ? 'error' : ''}`}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors({ ...errors, password: null })
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-icon-right-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <div className="error-msg">
                  <AlertCircle size={13} /> {errors.password}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Security badge footer */}
          <div className="security-footer">
            <ShieldCheck size={14} /> 256-Bit TLS Secured Pharmacy Gateway
          </div>
        </div>
      </div>
    </div>
  )
}
