import api from './client';

export type Appointment = {
  id: string;
  appointment_date?: string | null;
  appointment_time?: string | null;
  duration?: number | null;
  notes?: string | null;
  payment_status?: string | null;
  status?: string | null;
  customers?: {
    id: string;
    name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  services?: {
    id: string;
    name?: string | null;
    price?: number | null;
  } | null;
  pets?: {
    id: string;
    name?: string | null;
    breed?: string | null;
    photo_url?: string | null;
  } | null;
};

type AppointmentsResponse = {
  data: Appointment[];
  meta?: {
    nextOffset?: number | null;
  };
};

export type CreateAppointmentPayload = {
  appointment_date: string;
  appointment_time: string;
  customer_id: string;
  pet_id: string;
  service_id: string;
  duration?: number | null;
  notes?: string | null;
  payment_status?: string | null;
  status?: string | null;
};

type CreateAppointmentResponse = {
  data: Appointment[];
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

export async function getAppointments(params?: {
  from?: string | Date | null;
  to?: string | Date | null;
  limit?: number;
  offset?: number;
}): Promise<{ items: Appointment[]; nextOffset: number | null }> {
  const query = new URLSearchParams();
  const from = normalizeDate(params?.from);
  const to = normalizeDate(params?.to);

  if (from) query.set('date_from', from);
  if (to) query.set('date_to', to);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));

  const search = query.toString();
  const url = search ? `/appointments?${search}` : '/appointments';
  const { data } = await api.get<AppointmentsResponse>(url);
  return { items: data.data || [], nextOffset: data.meta?.nextOffset ?? null };
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
  const body = {
    payment_status: 'unpaid',
    ...payload,
    duration: payload.duration ?? null,
    notes: payload.notes ?? null,
  };
  const { data } = await api.post<CreateAppointmentResponse>('/appointments', body);
  return data.data?.[0] || payload;
}
