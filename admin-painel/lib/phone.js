export const DEFAULT_COUNTRY_CODE = '+351'

export function normalizeCountryCode(value, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) return fallback
  const digits = value.toString().replace(/\D/g, '')
  if (!digits) return fallback
  return `+${digits}`
}

export function normalizePhoneNumber(value) {
  if (value === undefined || value === null) return ''
  return value.toString().replace(/\D/g, '')
}

export function splitPhone(value, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) {
    return { phoneCountryCode: fallback, phoneNumber: '' }
  }
  const trimmed = value.toString().trim()
  const match = trimmed.match(/^\+(\d{1,3})\s*(.*)$/)
  if (match) {
    return {
      phoneCountryCode: `+${match[1]}`,
      phoneNumber: normalizePhoneNumber(match[2])
    }
  }
  return {
    phoneCountryCode: fallback,
    phoneNumber: normalizePhoneNumber(trimmed)
  }
}

export function buildPhone(phoneCountryCode, phoneNumber) {
  const digits = normalizePhoneNumber(phoneNumber)
  if (!digits) return ''
  return `${normalizeCountryCode(phoneCountryCode)} ${digits}`.trim()
}

export function formatPhoneDisplay(value, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) return ''
  const { phoneCountryCode, phoneNumber } = splitPhone(value, fallback)
  return buildPhone(phoneCountryCode, phoneNumber)
}
