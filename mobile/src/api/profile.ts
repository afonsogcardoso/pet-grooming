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
  const { data } = await api.get<Profile>('/profile');
  return data;
}

export async function updateProfile(payload: {
  displayName?: string | null;
  phone?: string | null;
  locale?: string | null;
  avatarUrl?: string | null;
}): Promise<Profile> {
  const { data } = await api.patch<{ user: any }>('/profile', payload);
  return data.user;
}

export async function uploadAvatar(formData: FormData): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>('/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
