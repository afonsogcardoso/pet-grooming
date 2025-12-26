import api from './client';

export type Branding = {
  account_name?: string | null;
  brand_primary?: string | null;
  brand_primary_soft?: string | null;
  brand_accent?: string | null;
  brand_accent_soft?: string | null;
  brand_background?: string | null;
  brand_gradient?: string | null;
  logo_url?: string | null;
  portal_image_url?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
  marketplace_description?: string | null;
  marketplace_instagram_url?: string | null;
  marketplace_facebook_url?: string | null;
  marketplace_tiktok_url?: string | null;
  marketplace_website_url?: string | null;
};

type BrandingResponse = {
  data: Branding;
};

export type BrandingUpdatePayload = {
  name?: string | null;
  brand_primary?: string | null;
  brand_primary_soft?: string | null;
  brand_accent?: string | null;
  brand_accent_soft?: string | null;
  brand_background?: string | null;
  brand_gradient?: string | null;
  logo_url?: string | null;
  portal_image_url?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
  marketplace_description?: string | null;
  marketplace_instagram_url?: string | null;
  marketplace_facebook_url?: string | null;
  marketplace_tiktok_url?: string | null;
  marketplace_website_url?: string | null;
};

export async function getBranding(accountId?: string): Promise<Branding> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const { data } = await api.get<BrandingResponse>(`/branding${query}`);
  return data.data;
}

export async function updateBranding(payload: BrandingUpdatePayload): Promise<Branding> {
  const { data } = await api.patch<BrandingResponse>('/branding', payload);
  return data.data;
}

export async function uploadBrandLogo(formData: FormData): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>('/branding/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
