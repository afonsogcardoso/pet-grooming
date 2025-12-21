import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Branding, getBranding } from '../api/branding';
import { writeBrandingCache } from './brandingCache';

type ThemeColors = {
  primary: string;
  primarySoft: string;
  accent: string;
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  muted: string;
  onPrimary: string;
  danger: string;
  warning: string;
  success: string;
};

function parseHex(input?: string | null) {
  if (!input) return null;
  const hex = input.trim().replace('#', '');
  if (![3, 6].includes(hex.length)) return null;
  const normalized = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  if ([r, g, b].some(v => Number.isNaN(v))) return null;
  return { r, g, b };
}

function isLightColor(color?: string | null) {
  const rgb = parseHex(color);
  if (!rgb) return false;
  // Perceived luminance (ITU-R BT.709)
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.65;
}

function withAlpha(color: string, alpha: number) {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function useBrandingTheme() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['branding'],
    // Query should already be primed by App bootstrap; keep fetch here as safety.
    queryFn: () => getBranding(),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    enabled: Boolean(queryClient.getQueryData<Branding>(['branding'])), // avoid firing before bootstrap
    initialData: () => queryClient.getQueryData<Branding>(['branding']),
    placeholderData: () => queryClient.getQueryData<Branding>(['branding']),
  });

  const colors: ThemeColors = useMemo(() => {
    const branding = query.data as Branding | undefined;
    const background = branding?.brand_background || '#FFF7EE';
    const backgroundIsLight = isLightColor(background);

    const primary = branding?.brand_primary || '#F47C1C';
    const primarySoft = branding?.brand_primary_soft || '#FFA85C';
    const accent = branding?.brand_accent || '#D65A00';

    const surface = branding?.brand_primary_soft
      ? branding.brand_primary_soft
      : backgroundIsLight
        ? '#FFF7EE'
        : '#1E1E1E';

    const text = backgroundIsLight ? '#1E1E1E' : '#FFF7EE';
    const muted = backgroundIsLight ? '#6F6F6F' : '#FFA85C';
    const surfaceBorder = withAlpha(text, backgroundIsLight ? 0.12 : 0.2);
    const onPrimary = isLightColor(primary) ? '#111827' : '#ffffff';

    return {
      primary,
      primarySoft,
      accent,
      background,
      surface,
      surfaceBorder,
      text,
      muted,
      onPrimary,
      danger: '#dc2626',
      warning: '#d97706',
      success: '#059669',
    };
  }, [query.data]);

  useEffect(() => {
    const data = query.data as Branding | undefined;
    if (data) {
      writeBrandingCache(data);
    }
  }, [query.data]);

  return {
    branding: query.data,
    isLoading: query.isLoading,
    error: query.error,
    colors,
  };
}
