/**
 * Utilities for reading, writing, and clearing browser cookies.
 */

export const getCookie = (name) => {
  if (typeof document === 'undefined') return null
  const matches = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
  )
  return matches ? decodeURIComponent(matches[1]) : null
}

export const setCookie = (name, value, options = {}) => {
  if (typeof document === 'undefined') return
  const opts = {
    path: '/',
    sameSite: 'lax',
    ...options,
  }

  if (typeof opts.maxAge === 'number') {
    opts['max-age'] = opts.maxAge
    delete opts.maxAge
  }

  if (opts.expires instanceof Date) {
    opts.expires = opts.expires.toUTCString()
  }

  let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
  for (const [key, val] of Object.entries(opts)) {
    cookieStr += `; ${key}`
    if (val !== true) {
      cookieStr += `=${val}`
    }
  }
  document.cookie = cookieStr
}

export const deleteCookie = (name, options = {}) => {
  setCookie(name, '', { path: '/', ...options, 'max-age': -1 })
}
