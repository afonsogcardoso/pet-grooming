import api from './client';

export type PetSpecies = {
  id: string;
  name: string;
};

export type PetBreed = {
  id: string;
  name: string;
  species_id: string;
};

export async function getPetSpecies(): Promise<PetSpecies[]> {
  const { data } = await api.get<{ data: PetSpecies[] }>('/pet-attributes/species');
  return data.data || [];
}

export async function getPetBreeds(params: { speciesId?: string | null; query?: string } = {}): Promise<PetBreed[]> {
  const { speciesId, query } = params;
  const { data } = await api.get<{ data: PetBreed[] }>('/pet-attributes/breeds', {
    params: {
      speciesId: speciesId || undefined,
      q: query?.trim() || undefined,
    },
  });
  return data.data || [];
}
