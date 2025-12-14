import api from './client';

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthResponse = {
  token: string;
  refreshToken?: string;
  email?: string;
  displayName?: string;
};

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function refresh(token: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken: token });
  return data;
}
