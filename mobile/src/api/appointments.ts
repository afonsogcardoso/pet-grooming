import api from './client';

export type Appointment = {
  id: string;
  appointment_date?: string | null;
  appointment_time?: string | null;
  duration?: number | null;
  notes?: string | null;
  payment_status?: string | null;
  status?: string | null;
  reminder_offsets?: number[] | null;
  public_token?: string | null;
  amount?: number | null;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
  customers?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
    address2?: string | null;
    nif?: string | null;
  } | null;
  services?: {
    id: string;
    name?: string | null;
    price?: number | null;
  } | null;
  appointment_services?: Array<{
    id?: string;
    service_id: string;
    pet_id?: string | null;
    price_tier_id?: string | null;
    price_tier_label?: string | null;
    price_tier_price?: number | null;
    services: {
      id: string;
      name?: string | null;
      price?: number | null;
      display_order?: number | null;
    };
    pets?: {
      id: string;
      name?: string | null;
      breed?: string | null;
      photo_url?: string | null;
      weight?: number | null;
    } | null;
    appointment_service_addons?: Array<{
      id?: string;
      service_addon_id?: string | null;
      name?: string | null;
      price?: number | null;
    }> | null;
  }> | null;
  pets?: {
    id: string;
    name?: string | null;
    breed?: string | null;
    photo_url?: string | null;
    weight?: number | null;
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
  pet_id?: string;
  service_id?: string;
  service_ids?: string[];
  service_selections?: Array<{
    pet_id?: string | null;
    service_id: string;
    price_tier_id?: string | null;
    addon_ids?: string[];
  }>;
  duration?: number | null;
  notes?: string | null;
  payment_status?: string | null;
  status?: string | null;
  amount?: number | null;
  reminder_offsets?: number[] | null;
};

type CreateAppointmentResponse = {
  data: Appointment;
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
  customerId?: string;
}): Promise<{ items: Appointment[]; nextOffset: number | null }> {
  const query = new URLSearchParams();
  const from = normalizeDate(params?.from);
  const to = normalizeDate(params?.to);

  if (from) query.set('date_from', from);
  if (to) query.set('date_to', to);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.customerId) query.set('customer_id', params.customerId);

  const search = query.toString();
  const url = search ? `/appointments?${search}` : '/appointments';
  const { data } = await api.get<AppointmentsResponse>(url);
  return { items: data.data || [], nextOffset: data.meta?.nextOffset ?? null };
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
  const { service_ids, service_selections, ...cleanPayload } = payload as any;
  const body = {
    payment_status: 'unpaid',
    ...cleanPayload,
    duration: payload.duration ?? null,
    notes: payload.notes ?? null,
    service_ids, // Keep this separate so backend can process it
    service_selections,
  };
  const { data } = await api.post<CreateAppointmentResponse>('/appointments', body);
  return data.data;
}

export async function getAppointment(id: string): Promise<Appointment> {
  const { data } = await api.get<{ data: Appointment }>(`/appointments/${id}`);
  return data.data || ({} as Appointment);
}

export async function getOverdueCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>(`/appointments/overdue-count`);
  return Number(data?.count || 0);
}

export async function updateAppointment(
  id: string,
  payload: Partial<CreateAppointmentPayload & { amount?: number | null }>,
): Promise<Appointment> {
  const { data } = await api.patch<{ data: Appointment }>(`/appointments/${id}`, payload);
  return data.data || ({} as Appointment);
}

export async function uploadAppointmentPhoto(
  appointmentId: string,
  type: 'before' | 'after',
  file: { uri: string; name: string; type: string },
  opts?: { appointmentServiceId?: string | null; serviceId?: string | null; petId?: string | null },
): Promise<{ url: string } | any> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);
  formData.append('type', type);
  if (opts?.appointmentServiceId) formData.append('appointment_service_id', String(opts.appointmentServiceId));
  if (opts?.serviceId) formData.append('service_id', String(opts.serviceId));
  if (opts?.petId) formData.append('pet_id', String(opts.petId));

  const { data } = await api.post<any>(`/appointments/${appointmentId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // Backend may return { url } or { data: insertedRow }
  if (!data) return { url: '' };
  if (data.url) return { url: data.url };
  const inserted = data.data || data;
  if (inserted && inserted.url) return { url: inserted.url };
  if (Array.isArray(inserted) && inserted[0] && inserted[0].url) return { url: inserted[0].url };
  // fallback: return raw payload
  return data;
}

export async function deleteAppointment(id: string): Promise<void> {
  await api.delete(`/appointments/${id}`);
}

export async function deleteAppointmentPhoto(photoId: string): Promise<void> {
  await api.delete(`/appointments/photos/${photoId}`);
}
