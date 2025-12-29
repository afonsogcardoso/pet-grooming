import api from './client';

export type MarketplaceAccount = {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  portal_image_url?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
  marketplace_categories?: string[] | null;
  marketplace_description?: string | null;
  marketplace_instagram_url?: string | null;
  marketplace_facebook_url?: string | null;
  marketplace_tiktok_url?: string | null;
  marketplace_website_url?: string | null;
  brand_primary?: string | null;
  brand_primary_soft?: string | null;
  brand_accent?: string | null;
  brand_accent_soft?: string | null;
  brand_background?: string | null;
};

export type MarketplaceService = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  price?: number | null;
  default_duration?: number | null;
  category?: string | null;
  subcategory?: string | null;
  pet_type?: string | null;
  pricing_model?: string | null;
};

export type MarketplaceBookingPayload = {
  account_slug: string;
  appointment_date: string;
  appointment_time: string;
  service_id?: string;
  service_ids?: string[];
  pet_id?: string;
  save_pet?: boolean;
  notes?: string | null;
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    nif?: string | null;
  };
  pet?: {
    name?: string | null;
    breed?: string | null;
    weight?: number | null;
  };
};

type MarketplaceAccountsResponse = {
  data: MarketplaceAccount[];
};

type MarketplaceServicesResponse = {
  data: MarketplaceService[];
};

export async function getMarketplaceAccounts(params?: {
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<MarketplaceAccount[]> {
  const { data } = await api.get<MarketplaceAccountsResponse>('/marketplace/accounts', {
    params,
  });
  return data.data || [];
}

export async function getMarketplaceAccount(slug: string): Promise<MarketplaceAccount> {
  const { data } = await api.get<{ account: MarketplaceAccount }>(
    `/marketplace/accounts/${slug}`
  );
  return data.account;
}

export async function getMarketplaceAccountServices(
  slug: string
): Promise<MarketplaceService[]> {
  const { data } = await api.get<MarketplaceServicesResponse>(
    `/marketplace/accounts/${slug}/services`
  );
  return data.data || [];
}

export async function createMarketplaceBooking(payload: MarketplaceBookingPayload): Promise<{
  appointment: any;
  customer_id?: string;
  pet_id?: string;
}> {
  const { data } = await api.post<{ data: any }>('/marketplace/booking-requests', payload);
  return data.data;
}
