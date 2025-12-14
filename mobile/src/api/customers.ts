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
  nif?: string | null;
  pet_count?: number | null;
  pets?: Pet[] | null;
};

type CustomersResponse = {
  data: Customer[];
};

type PetsResponse = {
  data: Pet[];
};

type CreateCustomerPayload = {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  nif?: string | null;
};

type CreatePetPayload = {
  name: string;
  breed?: string | null;
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

export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  const { data } = await api.post<{ data: Customer } | { data: Customer[] }>('/customers', payload);
  // API may return object or array; normalize
  const customer = (data as any)?.data;
  return Array.isArray(customer) ? customer[0] : customer;
}

export async function createPet(customerId: string, payload: CreatePetPayload): Promise<Pet> {
  const { data } = await api.post<{ data: Pet } | { data: Pet[] }>(
    `/customers/${customerId}/pets`,
    payload,
  );
  const pet = (data as any)?.data;
  return Array.isArray(pet) ? pet[0] : pet;
}
