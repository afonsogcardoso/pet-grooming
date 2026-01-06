import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Branding, getBranding } from '../api/branding';
import { writeBrandingCache } from './brandingCache';
import { useAuthStore } from '../state/authStore';
import { useViewModeStore } from '../state/viewModeStore';

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
  switchTrack: string;
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

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
};

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const named = NAMED_COLORS[trimmed.toLowerCase()];
  if (named) return named;
  const parsed = parseHex(trimmed);
  if (!parsed) return fallback;
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
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
  const activeRole = useAuthStore((state) => state.user?.activeRole);
  const viewMode = useViewModeStore((state) => state.viewMode);
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
    const roleForTheme =
      viewMode === 'consumer'
        ? 'consumer'
        : viewMode === 'private'
          ? 'provider'
          : activeRole;
    const paletteBranding = roleForTheme === 'consumer' ? undefined : branding;
    const background = normalizeHexColor(paletteBranding?.brand_background, '#FFF7EE');
    const backgroundIsLight = isLightColor(background);

    const primary = normalizeHexColor(paletteBranding?.brand_primary, '#F47C1C');
    const primarySoftCandidate = normalizeHexColor(paletteBranding?.brand_primary_soft, '');
    const primarySoft = primarySoftCandidate || '#FFA85C';
    const accent = normalizeHexColor(paletteBranding?.brand_accent, '#D65A00');

    const surface = primarySoftCandidate
      ? primarySoftCandidate
      : backgroundIsLight
        ? '#FFF7EE'
        : '#1E1E1E';

    const text = backgroundIsLight ? '#1E1E1E' : '#FFF7EE';
    const muted = backgroundIsLight ? '#6F6F6F' : '#FFA85C';
    const surfaceBorder = withAlpha(text, backgroundIsLight ? 0.12 : 0.2);
    const onPrimary = isLightColor(primary) ? '#111827' : '#ffffff';
    // Make active switch track more visible across light backgrounds — increase alpha
    const switchTrack = withAlpha(primary, 0.32);

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
      switchTrack,
      danger: '#dc2626',
      warning: '#d97706',
      success: '#059669',
    };
  }, [query.data, activeRole, viewMode]);

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
