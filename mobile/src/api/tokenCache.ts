let cachedToken: string | null = null;

export function getCachedToken() {
  return cachedToken;
}

export function setCachedToken(token: string | null) {
  cachedToken = token;
}

export function resetTokenCache() {
  cachedToken = null;
}
