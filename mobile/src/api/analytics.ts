import api from './client';

type DateLike = string | Date | null | undefined;

export type BillingDailyEntry = {
  day: string;
  bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  revenue_booked: number;
  revenue_completed: number;
};

export type BillingServiceEntry = {
  day: string;
  service_id: string | null;
  service_name?: string | null;
  bookings: number;
  revenue_booked: number;
  revenue_completed: number;
};

export type BillingTopService = {
  service_id: string | null;
  service_name?: string | null;
  bookings: number;
  revenue: number;
};

export type BillingTopCustomer = {
  customer_id: string | null;
  name: string | null;
  visits: number;
  revenue: number;
};

export type BillingSummary = {
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
  avgTicket: number;
  returningRate: number;
};

export type BillingAnalyticsResponse = {
  daily: BillingDailyEntry[];
  services: BillingServiceEntry[];
  topServices: BillingTopService[];
  topCustomers: BillingTopCustomer[];
  summary: BillingSummary;
};

function normalizeDate(value: DateLike): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, '0');
    const d = `${value.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'string') return value.slice(0, 10);
  return undefined;
}

export async function getBillingAnalytics(params?: {
  from?: DateLike;
  to?: DateLike;
}): Promise<BillingAnalyticsResponse> {
  const searchParams = new URLSearchParams();
  const from = normalizeDate(params?.from);
  const to = normalizeDate(params?.to);

  if (from) searchParams.set('from', from);
  if (to) searchParams.set('to', to);

  const qs = searchParams.toString();
  const url = qs ? `/analytics/billing?${qs}` : '/analytics/billing';
  const { data } = await api.get<BillingAnalyticsResponse>(url);
  return data;
}
