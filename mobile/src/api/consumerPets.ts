import api from './client';

export type ConsumerPet = {
  id: string;
  name: string;
  breed?: string | null;
  weight?: number | null;
  photo_url?: string | null;
};

type ConsumerPetsResponse = {
  data: ConsumerPet[];
};

export async function getConsumerPets(): Promise<ConsumerPet[]> {
  const { data } = await api.get<ConsumerPetsResponse>('/marketplace/pets');
  return data.data || [];
}

export async function createConsumerPet(payload: {
  name: string;
  breed?: string | null;
  weight?: number | null;
}): Promise<ConsumerPet> {
  const { data } = await api.post<{ data: ConsumerPet }>('/marketplace/pets', payload);
  return data.data;
}

export async function updateConsumerPet(
  id: string,
  payload: { name?: string; breed?: string | null; weight?: number | null }
): Promise<ConsumerPet> {
  const { data } = await api.patch<{ data: ConsumerPet }>(`/marketplace/pets/${id}`, payload);
  return data.data;
}

export async function deleteConsumerPet(id: string): Promise<void> {
  await api.delete(`/marketplace/pets/${id}`);
}
