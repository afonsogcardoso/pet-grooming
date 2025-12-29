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
  firstName?: string;
  lastName?: string;
  accountId?: string;
  accountSlug?: string;
  message?: string;
};

export type SignupPayload = {
  email: string;
  password: string;
  accountName?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'consumer' | 'provider';
};

export type OAuthSignupPayload = {
  accessToken: string;
  refreshToken?: string;
  accountName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: 'consumer' | 'provider';
};

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signup', payload);
  return data;
}

export async function oauthSignup(payload: OAuthSignupPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/oauth-signup', payload);
  return data;
}

export async function refresh(token: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken: token });
  return data;
}
