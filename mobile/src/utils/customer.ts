type CustomerNameSource = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} | null | undefined;

function normalizePart(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatCustomerName(customer: CustomerNameSource) {
  const first = normalizePart(customer?.firstName ?? null);
  const last = normalizePart(customer?.lastName ?? null);
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  const legacy = normalizePart(customer?.name ?? null);
  return legacy || '';
}
