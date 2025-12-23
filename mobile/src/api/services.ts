import api from './client';

export type Service = {
  id: string;
  name: string;
  description?: string | null;
  default_duration?: number | null;
  price?: number | null;
  active?: boolean | null;
  display_order?: number | null;
  category?: string | null;
  subcategory?: string | null;
  pet_type?: string | null;
  pricing_model?: string | null;
};

type ServicesResponse = {
  data: Service[];
};

export type ServicePriceTier = {
  id: string;
  service_id: string;
  label?: string | null;
  min_weight_kg?: number | null;
  max_weight_kg?: number | null;
  price: number;
  display_order?: number | null;
};

export type ServiceAddon = {
  id: string;
  service_id: string;
  name: string;
  description?: string | null;
  price: number;
  active?: boolean | null;
  display_order?: number | null;
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

export async function getServicePriceTiers(serviceId: string): Promise<ServicePriceTier[]> {
  const { data } = await api.get<{ data: ServicePriceTier[] }>(`/services/${serviceId}/price-tiers`);
  return data.data || [];
}

export async function createServicePriceTier(
  serviceId: string,
  payload: Omit<ServicePriceTier, 'id' | 'service_id'>
): Promise<ServicePriceTier> {
  const { data } = await api.post(`/services/${serviceId}/price-tiers`, payload);
  return data.data;
}

export async function updateServicePriceTier(
  serviceId: string,
  tierId: string,
  payload: Partial<Omit<ServicePriceTier, 'id' | 'service_id'>>
): Promise<ServicePriceTier> {
  const { data } = await api.patch(`/services/${serviceId}/price-tiers/${tierId}`, payload);
  return data.data;
}

export async function deleteServicePriceTier(serviceId: string, tierId: string): Promise<void> {
  await api.delete(`/services/${serviceId}/price-tiers/${tierId}`);
}

export async function getServiceAddons(serviceId: string): Promise<ServiceAddon[]> {
  const { data } = await api.get<{ data: ServiceAddon[] }>(`/services/${serviceId}/addons`);
  return data.data || [];
}

export async function createServiceAddon(
  serviceId: string,
  payload: Omit<ServiceAddon, 'id' | 'service_id'>
): Promise<ServiceAddon> {
  const { data } = await api.post(`/services/${serviceId}/addons`, payload);
  return data.data;
}

export async function updateServiceAddon(
  serviceId: string,
  addonId: string,
  payload: Partial<Omit<ServiceAddon, 'id' | 'service_id'>>
): Promise<ServiceAddon> {
  const { data } = await api.patch(`/services/${serviceId}/addons/${addonId}`, payload);
  return data.data;
}

export async function deleteServiceAddon(serviceId: string, addonId: string): Promise<void> {
  await api.delete(`/services/${serviceId}/addons/${addonId}`);
}
