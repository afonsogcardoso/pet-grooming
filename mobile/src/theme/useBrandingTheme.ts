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
    staleTime: 1000 * 60 * 60 * 6,
  });

  const colors: ThemeColors = useMemo(() => {
    const branding = query.data as Branding | undefined;
    const background = branding?.brand_background || '#f8fafc';
    const backgroundIsLight = isLightColor(background);

    const primary = branding?.brand_primary || '#22c55e';
    const primarySoft = branding?.brand_primary_soft || withAlpha(primary, 0.12);
    const accent = branding?.brand_accent || '#f97316';

    const surface = branding?.brand_primary_soft
      ? branding.brand_primary_soft
      : backgroundIsLight
        ? '#ffffff'
        : '#111827';

    const surfaceBorder = backgroundIsLight ? '#e5e7eb' : '#1f2937';
    const text = backgroundIsLight ? '#0f172a' : '#e2e8f0';
    const muted = backgroundIsLight ? '#4b5563' : '#94a3b8';
    const onPrimary = isLightColor(primary) ? '#0f172a' : '#f8fafc';

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
      danger: '#ef4444',
      warning: '#fbbf24',
      success: '#22c55e',
    };
  }, [query.data]);

  return {
    branding: query.data,
    isLoading: query.isLoading,
    error: query.error,
    colors,
  };
}
