import api from './client';

export type Service = {
  id: string;
  name: string;
  description?: string | null;
  default_duration?: number | null;
  price?: number | null;
  active?: boolean | null;
};

type ServicesResponse = {
  data: Service[];
};

export async function getServices(): Promise<Service[]> {
  const { data } = await api.get<ServicesResponse>('/services');
  const items = data.data || [];
  return items.filter((service) => service.active !== false);
}
