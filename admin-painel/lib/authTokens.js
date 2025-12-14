const ACCESS_TOKEN_KEY = 'admin_access_token'
const REFRESH_TOKEN_KEY = 'admin_refresh_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const ACCESS_COOKIE = 'admin_access_token'

function setStorageItem(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.setItem(key, value)
  } catch (error) {
    console.warn('Unable to persist auth token', error)
  }
}

function removeStorageItem(key) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage?.removeItem(key)
  } catch (error) {
    console.warn('Unable to clear auth token', error)
  }
}

function readStorageItem(key) {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage?.getItem(key) || null
  } catch (error) {
    console.warn('Unable to read auth token from storage', error)
    return null
  }
}

function setCookie(name, value, { maxAge = COOKIE_MAX_AGE } = {}) {
  if (typeof document === 'undefined') return
  const encoded = encodeURIComponent(value)
  document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; samesite=lax`
}

function clearCookie(name) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0`
}

export function storeAuthTokens({ token, refreshToken }) {
  if (!token) return

  setStorageItem(ACCESS_TOKEN_KEY, token)
  if (refreshToken) {
    setStorageItem(REFRESH_TOKEN_KEY, refreshToken)
  }

  // Keep a non-HTTP-only cookie so server components podem ler o token
  setCookie(ACCESS_COOKIE, token)
}

export function clearAuthTokens() {
  removeStorageItem(ACCESS_TOKEN_KEY)
  removeStorageItem(REFRESH_TOKEN_KEY)

  clearCookie(ACCESS_COOKIE)
}

export function getStoredTokens() {
  const token = readStorageItem(ACCESS_TOKEN_KEY)
  const refreshToken = readStorageItem(REFRESH_TOKEN_KEY)
  return { token, refreshToken }
}

export function getStoredAccessToken() {
  const { token } = getStoredTokens()
  return token || null
}
