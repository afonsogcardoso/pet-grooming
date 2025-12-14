export function sanitizeBody(body = {}) {
  return Object.entries(body || {}).reduce((acc, [key, value]) => {
    if (value === undefined) return acc
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return acc
      acc[key] = trimmed
      return acc
    }
    acc[key] = value
    return acc
  }, {})
}
