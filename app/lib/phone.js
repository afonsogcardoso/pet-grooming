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
  const fallbackCode = normalizeCountryCode(fallback)
  if (value === undefined || value === null) {
    return { phoneCountryCode: fallbackCode, phoneNumber: '' }
  }
  const trimmed = value.toString().trim()
  if (!trimmed) {
    return { phoneCountryCode: fallbackCode, phoneNumber: '' }
  }

  let normalized = trimmed
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`
  }

  const match = normalized.match(/^\+(\d{1,3})\s*(.*)$/)
  if (match) {
    return {
      phoneCountryCode: `+${match[1]}`,
      phoneNumber: normalizePhoneNumber(match[2])
    }
  }

  const fallbackDigits = fallbackCode.replace(/\D/g, '')
  const digits = normalizePhoneNumber(normalized)

  if (fallbackDigits && digits.startsWith(fallbackDigits) && digits.length > fallbackDigits.length) {
    return {
      phoneCountryCode: `+${fallbackDigits}`,
      phoneNumber: digits.slice(fallbackDigits.length)
    }
  }

  return {
    phoneCountryCode: fallbackCode,
    phoneNumber: digits
  }
}

export function buildPhone(phoneCountryCode, phoneNumber) {
  const digits = normalizePhoneNumber(phoneNumber)
  if (!digits) return ''
  const normalizedCode = normalizeCountryCode(phoneCountryCode)
  const codeDigits = normalizedCode.replace(/\D/g, '')
  const localDigits =
    codeDigits && digits.startsWith(codeDigits) && digits.length > codeDigits.length
      ? digits.slice(codeDigits.length)
      : digits
  return `${normalizedCode} ${localDigits}`.trim()
}

export function formatPhoneDisplay(value, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) return ''
  const { phoneCountryCode, phoneNumber } = splitPhone(value, fallback)
  return buildPhone(phoneCountryCode, phoneNumber)
}

export function formatPhoneForWhatsapp(value, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) return ''
  const fallbackDigits = normalizeCountryCode(fallback).replace(/\D/g, '')
  const trimmed = value.toString().trim()
  let digits = normalizePhoneNumber(trimmed)
  if (!digits) return ''
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }
  if (trimmed.startsWith('+')) return digits
  if (digits.startsWith(fallbackDigits) && digits.length > fallbackDigits.length) {
    return digits
  }
  return `${fallbackDigits}${digits}`
}
