import * as invitationService from '../services/invitation.service.js'
import { presentInvitation } from '../models/invitation.model.js'

/** Public invitation pages (Laravel's InvitationController): HTTP in, JSON out */

export async function show(req, res) {
  const invitation = await invitationService.usable(req.params.token)
  res.json(presentInvitation(invitation))
}

/** Sets the password and signs the person straight in: the body is exactly a successful login's ({ token, user }) */
export async function accept(req, res) {
  const session = await invitationService.acceptAndSignIn(req, req.params.token, req.body.password)
  if (session?.token) {
    const cookieOptions = {
      path: '/',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }
    res.cookie('auth_token', session.token, cookieOptions)
    res.cookie('token', session.token, cookieOptions)
  }
  res.json(session)
}
