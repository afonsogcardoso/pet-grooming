import api from './client';

export type Pet = {
  id: string;
  name: string;
  breed?: string | null;
  photo_url?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  pet_count?: number | null;
  pets?: Pet[] | null;
};

type CustomersResponse = {
  data: Customer[];
};

type PetsResponse = {
  data: Pet[];
};

export async function getCustomers(): Promise<Customer[]> {
  const { data } = await api.get<CustomersResponse>('/customers');
  return (data.data || []).map((customer) => ({
    ...customer,
    pets: customer.pets || [],
  }));
}

export async function getPetsByCustomer(customerId: string): Promise<Pet[]> {
  const { data } = await api.get<PetsResponse>(`/customers/${customerId}/pets`);
  return data.data || [];
}

export async function updateCustomer(
  id: string,
  payload: { phone?: string | null; address?: string | null; nif?: string | null },
): Promise<Customer | null> {
  const { data } = await api.patch<{ data: Customer[] }>(`/customers/${id}`, payload);
  return data.data?.[0] || null;
}
