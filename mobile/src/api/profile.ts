import api from './client';

export type Profile = {
  email: string;
  displayName?: string | null;
  phone?: string | null;
  locale?: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
};

export async function getProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>('/profile');
  return data;
}
