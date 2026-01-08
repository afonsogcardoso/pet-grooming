import api from './client';

export type Branding = {
  id?: string;
  account_id?: string;
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
  marketplace_region?: string | null;
  marketplace_description?: string | null;
  marketplace_instagram_url?: string | null;
  marketplace_facebook_url?: string | null;
  marketplace_tiktok_url?: string | null;
  marketplace_website_url?: string | null;
  marketplace_enabled?: boolean;
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
  marketplace_region?: string | null;
  marketplace_description?: string | null;
  marketplace_instagram_url?: string | null;
  marketplace_facebook_url?: string | null;
  marketplace_tiktok_url?: string | null;
  marketplace_website_url?: string | null;
  marketplace_enabled?: boolean;
};

function buildAccountQuery(accountId?: string | null) {
  return accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
}

export async function getBranding(accountId?: string): Promise<Branding> {
  const query = buildAccountQuery(accountId);
  const { data } = await api.get<BrandingResponse>(`/branding${query}`);
  return data.data;
}

export async function updateBranding(
  payload: BrandingUpdatePayload,
  accountId?: string | null,
): Promise<Branding> {
  const query = buildAccountQuery(accountId);
  const { data } = await api.patch<BrandingResponse>(`/branding${query}`, payload);
  return data.data;
}

type BrandingUploadResponse = { url: string; data?: Branding };

export async function uploadBrandLogo(
  formData: FormData,
  accountId?: string | null,
): Promise<BrandingUploadResponse> {
  const query = buildAccountQuery(accountId);
  const { data } = await api.post<BrandingUploadResponse>(`/branding/logo${query}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function uploadPortalImage(
  formData: FormData,
  accountId?: string | null,
): Promise<BrandingUploadResponse> {
  const query = buildAccountQuery(accountId);
  const { data } = await api.post<BrandingUploadResponse>(
    `/branding/portal-image${query}`,
    formData,
    {
    headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return data;
}
