import api from './client';

export type ConsumerAppointment = {
  id: string;
  appointment_date?: string | null;
  appointment_time?: string | null;
  duration?: number | null;
  notes?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount?: number | null;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  account?: {
    id: string;
    name?: string | null;
    slug?: string | null;
    logo_url?: string | null;
    support_email?: string | null;
    support_phone?: string | null;
  } | null;
  customers?: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  pets?: {
    id: string;
    name?: string | null;
    breed?: string | null;
    photo_url?: string | null;
    weight?: number | null;
  } | null;
  services?: {
    id: string;
    name?: string | null;
    price?: number | null;
  } | null;
  appointment_services?: Array<{
    id?: string;
    service_id?: string | null;
    services?: {
      id: string;
      name?: string | null;
      price?: number | null;
    } | null;
    pets?: {
      id: string;
      name?: string | null;
    } | null;
  }> | null;
};

type ConsumerAppointmentsResponse = {
  data: ConsumerAppointment[];
  meta?: {
    nextOffset?: number | null;
  };
};

function normalizeDate(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, '0');
    const d = `${value.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return undefined;
}

export async function getConsumerAppointments(params?: {
  status?: string | null;
  from?: string | Date | null;
  to?: string | Date | null;
  limit?: number;
  offset?: number;
}): Promise<{ items: ConsumerAppointment[]; nextOffset: number | null }> {
  const query = new URLSearchParams();
  const from = normalizeDate(params?.from);
  const to = normalizeDate(params?.to);

  if (params?.status) query.set('status', params.status);
  if (from) query.set('date_from', from);
  if (to) query.set('date_to', to);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));

  const search = query.toString();
  const url = search ? `/marketplace/my-appointments?${search}` : '/marketplace/my-appointments';
  const { data } = await api.get<ConsumerAppointmentsResponse>(url);
  return { items: data.data || [], nextOffset: data.meta?.nextOffset ?? null };
}

export async function getConsumerAppointment(id: string): Promise<ConsumerAppointment> {
  const { data } = await api.get<{ data: ConsumerAppointment }>(`/marketplace/my-appointments/${id}`);
  return data.data;
}

export async function cancelConsumerAppointment(id: string): Promise<ConsumerAppointment> {
  const { data } = await api.patch<{ data: ConsumerAppointment }>(
    `/marketplace/my-appointments/${id}/cancel`
  );
  return data.data;
}
