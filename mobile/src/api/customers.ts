import api from './client';

export type Pet = {
  id: string;
  name: string;
  breed?: string | null;
  weight?: number | null;
  photo_url?: string | null;
  species_id?: string | null;
  breed_id?: string | null;
};

export type Customer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  address2?: string | null;
  nif?: string | null;
  photo_url?: string | null;
  pet_count?: number | null;
  appointment_count?: number | null;
  pets?: Pet[] | null;
};

type CustomersResponse = {
  data: Customer[];
};

type PetsResponse = {
  data: Pet[];
};

type CreateCustomerPayload = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  address2?: string | null;
  nif?: string | null;
};

type CreatePetPayload = {
  name: string;
  breed?: string | null;
  weight?: number | null;
  speciesId?: string | null;
  breedId?: string | null;
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
  payload: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    address?: string | null;
    address2?: string | null;
    nif?: string | null;
  },
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

export async function updatePet(
  customerId: string,
  petId: string,
  payload: Partial<CreatePetPayload>,
): Promise<Pet> {
  const { data } = await api.patch<{ data: Pet[] }>(
    `/customers/${customerId}/pets/${petId}`,
    payload,
  );
  return data.data[0];
}

export async function uploadPetPhoto(
  petId: string,
  file: { uri: string; name: string; type: string },
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  const { data } = await api.post<{ url: string }>(
    `/customers/${petId}/pet-photo`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}

export async function uploadCustomerPhoto(
  customerId: string,
  file: { uri: string; name: string; type: string },
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  const { data } = await api.post<{ url: string }>(
    `/customers/${customerId}/photo`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}

export async function deleteCustomer(customerId: string): Promise<void> {
  await api.delete(`/customers/${customerId}`);
}

export async function deletePet(customerId: string, petId: string): Promise<void> {
  await api.delete(`/customers/${customerId}/pets/${petId}`);
}
