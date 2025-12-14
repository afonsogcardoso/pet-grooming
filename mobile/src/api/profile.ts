import api from './client';

export type Profile = {
  id: string;
  email: string;
  displayName?: string | null;
  phone?: string | null;
  locale?: string | null;
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  memberships?: any[];
  platformAdmin?: boolean;
};

export async function getProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>('/auth/profile');
  return data;
}
