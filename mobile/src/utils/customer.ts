type CustomerNameSource = {
  firstName?: string | null;
  lastName?: string | null;
} | null | undefined;

type CustomerAddressSource = {
  address?: string | null;
  address2?: string | null;
} | null | undefined;

function normalizePart(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatCustomerName(customer: CustomerNameSource) {
  const first = normalizePart(customer?.firstName ?? null);
  const last = normalizePart(customer?.lastName ?? null);
  const combined = [first, last].filter(Boolean).join(' ');
  return combined;
}

export function getCustomerFirstName(customer: CustomerNameSource) {
  return normalizePart(customer?.firstName ?? null);
}

export function formatCustomerAddress(customer: CustomerAddressSource, separator = ', ') {
  const line1 = normalizePart(customer?.address ?? null);
  const line2 = normalizePart(customer?.address2 ?? null);
  return [line1, line2].filter(Boolean).join(separator);
}
