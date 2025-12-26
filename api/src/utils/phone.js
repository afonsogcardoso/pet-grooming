const DEFAULT_COUNTRY_CODE = '+351'

function normalizeCountryCode(value, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) return fallback
  const digits = value.toString().replace(/\D/g, '')
  if (!digits) return fallback
  return `+${digits}`
}

function normalizePhoneNumber(value) {
  if (value === undefined || value === null) return null
  const digits = value.toString().replace(/\D/g, '')
  return digits || null
}

function splitPhone(value, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) {
    return { phone_country_code: fallback, phone_number: null }
  }
  const trimmed = value.toString().trim()
  const match = trimmed.match(/^\+(\d{1,3})\s*(.*)$/)
  if (match) {
    return {
      phone_country_code: `+${match[1]}`,
      phone_number: normalizePhoneNumber(match[2])
    }
  }
  return {
    phone_country_code: fallback,
    phone_number: normalizePhoneNumber(trimmed)
  }
}

function buildPhone(phoneCountryCode, phoneNumber) {
  if (!phoneNumber) return null
  const code = normalizeCountryCode(phoneCountryCode)
  return `${code} ${phoneNumber}`.trim()
}

function normalizePhoneParts({
  phone,
  phoneCountryCode,
  phoneNumber,
  defaultCountryCode = DEFAULT_COUNTRY_CODE
}) {
  const normalizedCode = normalizeCountryCode(phoneCountryCode, defaultCountryCode)
  const normalizedNumber = normalizePhoneNumber(phoneNumber)
  if (normalizedNumber) {
    return {
      phone_country_code: normalizedCode,
      phone_number: normalizedNumber,
      phone: buildPhone(normalizedCode, normalizedNumber)
    }
  }

  const split = splitPhone(phone, defaultCountryCode)
  return {
    phone_country_code: split.phone_country_code,
    phone_number: split.phone_number,
    phone: buildPhone(split.phone_country_code, split.phone_number)
  }
}

export {
  DEFAULT_COUNTRY_CODE,
  normalizeCountryCode,
  normalizePhoneNumber,
  splitPhone,
  buildPhone,
  normalizePhoneParts
}
