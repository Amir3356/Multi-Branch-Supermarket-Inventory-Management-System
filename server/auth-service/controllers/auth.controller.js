import { presentAuthUser } from '../utils/index.js'
import * as auth from '../services/auth.service.js'

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function setAuthCookies(res, token) {
  const cookieOptions = {
    path: '/',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  }
  res.cookie('auth_token', token, cookieOptions)
  res.cookie('token', token, cookieOptions)
}

function clearAuthCookies(res) {
  res.clearCookie('auth_token', { path: '/' })
  res.clearCookie('token', { path: '/' })
}

/**
 *   POST /auth/login             { email, password }                → { token, user }
 *   POST /auth/forgot-password   { email }                          → { message }        (throttle 5/min, shared)
 *   POST /auth/reset-password    { token, email, password, password_confirmation } → { message, token, user }
 *   GET  /auth/me                                                   → { data: user }
 *   POST /auth/logout            { reason? }                        → { message }
 * Bodies arrive prepared and validated by middleware/validators/auth.validator.js.
 */

export async function login(req, res) {
  const session = await auth.login(req, req.body)
  if (session?.token) setAuthCookies(res, session.token)
  res.json(session)
}

export async function forgotPassword(req, res) {
  res.json({ message: await auth.forgotPassword(req, req.body.email) })
}

export async function resetPassword(req, res) {
  const result = await auth.resetPassword(req, req.body)
  if (result?.token) setAuthCookies(res, result.token)
  res.json({ message: 'Your password was reset.', ...result })
}

export async function me(req, res) {
  res.json({ data: presentAuthUser(await auth.currentUser(req.user.id)) })
}

export async function logout(req, res) {
  await auth.logout(req, req.body?.reason)
  clearAuthCookies(res)
  res.json({ message: 'Signed out.' })
}
