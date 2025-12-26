export const DEFAULT_COUNTRY_CODE = '+351';

export function normalizeCountryCode(value?: string | null, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) return fallback;
  const digits = value.toString().replace(/\D/g, '');
  if (!digits) return fallback;
  return `+${digits}`;
}

export function normalizePhoneNumber(value?: string | null) {
  if (value === undefined || value === null) return '';
  return value.toString().replace(/\D/g, '');
}

export function splitPhone(value?: string | null, fallback = DEFAULT_COUNTRY_CODE) {
  if (!value) {
    return { phoneCountryCode: fallback, phoneNumber: '' };
  }
  const trimmed = value.toString().trim();
  const match = trimmed.match(/^\+(\d{1,3})\s*(.*)$/);
  if (match) {
    return {
      phoneCountryCode: `+${match[1]}`,
      phoneNumber: normalizePhoneNumber(match[2]),
    };
  }
  return {
    phoneCountryCode: fallback,
    phoneNumber: normalizePhoneNumber(trimmed),
  };
}

export function buildPhone(phoneCountryCode?: string | null, phoneNumber?: string | null) {
  const digits = normalizePhoneNumber(phoneNumber);
  if (!digits) return '';
  return `${normalizeCountryCode(phoneCountryCode)} ${digits}`.trim();
}

export function toE164Digits(phoneCountryCode?: string | null, phoneNumber?: string | null) {
  const codeDigits = normalizeCountryCode(phoneCountryCode).replace(/\D/g, '');
  const numberDigits = normalizePhoneNumber(phoneNumber);
  if (!numberDigits) return '';
  return `${codeDigits}${numberDigits}`;
}
