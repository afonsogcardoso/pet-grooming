import api from './client';

export type Profile = {
  id: string;
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address?: string | null;
  address2?: string | null;
  phone?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  locale?: string | null;
  avatarUrl?: string | null;
  activeRole?: 'consumer' | 'provider' | null;
  availableRoles?: Array<'consumer' | 'provider'>;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  memberships?: any[];
  platformAdmin?: boolean;
  authProviders?: string[];
};

export async function getProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>('/profile?includeMemberships=true');
  return data;
}

export async function updateProfile(payload: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address?: string | null;
  address2?: string | null;
  phone?: string | null;
  locale?: string | null;
  avatarUrl?: string | null;
  activeRole?: 'consumer' | 'provider' | null;
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

export async function resetPassword(newPassword: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>('/profile/reset-password', { newPassword });
  return data;
}
