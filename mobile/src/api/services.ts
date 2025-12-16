import api from './client';

export type Service = {
  id: string;
  name: string;
  description?: string | null;
  default_duration?: number | null;
  price?: number | null;
  active?: boolean | null;
  display_order?: number | null;
};

type ServicesResponse = {
  data: Service[];
};

export async function getServices(): Promise<Service[]> {
  const { data } = await api.get<ServicesResponse>('/services');
  const items = data.data || [];
  return items.filter((service) => service.active !== false);
}

export async function getAllServices(): Promise<Service[]> {
  const { data } = await api.get<ServicesResponse>('/services');
  return data.data || [];
}

export async function createService(service: Omit<Service, 'id'>): Promise<Service> {
  const { data } = await api.post('/services', service);
  return data.data;
}

export async function updateService(id: string, service: Partial<Service>): Promise<Service> {
  const { data } = await api.patch(`/services/${id}`, service);
  return data.data;
}

export async function deleteService(id: string): Promise<void> {
  await api.delete(`/services/${id}`);
}

export async function updateServiceOrder(services: Array<{ id: string; display_order: number }>): Promise<void> {
  await Promise.all(
    services.map(service => 
      api.patch(`/services/${service.id}`, { display_order: service.display_order })
    )
  );
}
