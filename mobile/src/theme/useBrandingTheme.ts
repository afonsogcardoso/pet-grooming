import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Branding, getBranding } from '../api/branding';

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
  const query = useQuery({
    queryKey: ['branding'],
    queryFn: () => getBranding(),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
  });

  const colors: ThemeColors = useMemo(() => {
    const branding = query.data as Branding | undefined;
    const background = branding?.brand_background || '#ffffff';
    const backgroundIsLight = isLightColor(background);

    const primary = branding?.brand_primary || '#1e40af';
    const primarySoft = branding?.brand_primary_soft || withAlpha(primary, 0.08);
    const accent = branding?.brand_accent || '#0891b2';

    const surface = branding?.brand_primary_soft
      ? branding.brand_primary_soft
      : backgroundIsLight
        ? '#f9fafb'
        : '#111827';

    const surfaceBorder = backgroundIsLight ? '#d1d5db' : '#1f2937';
    const text = backgroundIsLight ? '#111827' : '#e2e8f0';
    const muted = backgroundIsLight ? '#6b7280' : '#94a3b8';
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

  return {
    branding: query.data,
    isLoading: query.isLoading,
    error: query.error,
    colors,
  };
}
