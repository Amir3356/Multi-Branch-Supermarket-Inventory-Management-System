import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { api } from './http'

// One WebSocket connection to Laravel Reverb, opened the first time a page needs live updates.
// Private channels are authorized by the API with the signed-in user's token.
let echo = null

export function realtime() {
  if (echo) return echo
  const key = import.meta.env.VITE_REVERB_APP_KEY
  if (!key) return null

  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http'
  echo = new Echo({
    broadcaster: 'reverb',
    Pusher,
    key,
    wsHost: import.meta.env.VITE_REVERB_HOST || 'localhost',
    wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        api('/broadcasting/auth', { method: 'POST', body: { socket_id: socketId, channel_name: channel.name } })
          .then((data) => callback(null, data))
          .catch((error) => callback(error, null))
      }
    })
  })
  return echo
}

// Calls onChange(connected) whenever the WebSocket connects or drops; returns an unsubscribe function
export function watchConnection(onChange) {
  const connection = realtime()?.connector.pusher.connection
  if (!connection) {
    onChange(false)
    return () => {}
  }
  const handler = ({ current }) => onChange(current === 'connected')
  connection.bind('state_change', handler)
  onChange(connection.state === 'connected')
  return () => connection.unbind('state_change', handler)
}
