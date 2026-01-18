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

export async function getBranding(accountId?: string): Promise<Branding> {
  const headers = accountId ? { 'X-Account-Id': accountId } : undefined;
  console.debug('[branding] GET', { accountId: accountId ?? null });
  const { data } = await api.get<BrandingResponse>('/branding', { headers });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try {
      const b = data.data;
      const summary = {
        id: b?.id,
        account_id: b?.account_id,
        brand_primary: !!b?.brand_primary,
        logo: !!b?.logo_url,
      };
      // eslint-disable-next-line no-console
      console.debug('branding carregado do servidor', summary);
    } catch (e) {
    }
  }
  return data.data;
}

export async function updateBranding(
  payload: BrandingUpdatePayload,
  accountId?: string | null,
): Promise<Branding> {
  const headers = accountId ? { 'X-Account-Id': accountId } : undefined;
  console.debug('[branding] PATCH', {
    accountId: accountId ?? null,
    keys: Object.keys(payload || {}),
  });
  const { data } = await api.patch<BrandingResponse>('/branding', payload, { headers });
  return data.data;
}

type BrandingUploadResponse = { url: string; data?: Branding };

export function brandingQueryKey(accountId?: string | null) {
  return ["branding", accountId ?? "default"] as const;
}

export async function uploadBrandLogo(
  formData: FormData,
  accountId?: string | null,
): Promise<BrandingUploadResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
  if (accountId) headers['X-Account-Id'] = accountId;
  console.debug('[branding] POST logo', { accountId: accountId ?? null });
  const { data } = await api.post<BrandingUploadResponse>('/branding/logo', formData, {
    headers,
  });
  return data;
}

export async function uploadPortalImage(
  formData: FormData,
  accountId?: string | null,
): Promise<BrandingUploadResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
  if (accountId) headers['X-Account-Id'] = accountId;
  console.debug('[branding] POST portal-image', { accountId: accountId ?? null });
  const { data } = await api.post<BrandingUploadResponse>('/branding/portal-image', formData, {
    headers,
  });
  return data;
}

export async function deleteBrandLogo(accountId?: string | null): Promise<Branding> {
  const headers = accountId ? { 'X-Account-Id': accountId } : undefined;
  console.debug('[branding] DELETE logo', { accountId: accountId ?? null });
  const { data } = await api.delete<BrandingResponse>('/branding/logo', { headers })
  return data.data
}

export async function deletePortalImage(accountId?: string | null): Promise<Branding> {
  const headers = accountId ? { 'X-Account-Id': accountId } : undefined;
  console.debug('[branding] DELETE portal-image', { accountId: accountId ?? null });
  const { data } = await api.delete<BrandingResponse>('/branding/portal-image', { headers })
  return data.data
}
