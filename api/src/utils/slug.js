export function normalizeSlug(value) {
  return value?.toString().trim().toLowerCase() || ''
}

export function sanitizeSlug(slug) {
  return slug
    ?.toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
