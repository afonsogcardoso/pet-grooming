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
};

type BrandingResponse = {
  data: Branding;
};

export async function getBranding(accountId?: string): Promise<Branding> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const { data } = await api.get<BrandingResponse>(`/branding${query}`);
  return data.data;
}
