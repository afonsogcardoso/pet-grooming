import Constants from 'expo-constants';

function resolveExtra() {
  return (
    (Constants as any).expoConfig?.extra ||
    (Constants as any).manifest?.extra ||
    (Constants as any).manifest2?.extra ||
    (Constants as any).manifestExtra
  );
}

export function resolveSupabaseUrl() {
  const extra = resolveExtra();
  const candidate = extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || null;

  if (!candidate) {
    console.warn('[auth] Supabase URL missing. Configure EXPO_PUBLIC_SUPABASE_URL.');
  }

  return candidate ? candidate.replace(/\/$/, '') : null;
}

export function resolveSupabaseAnonKey() {
  const extra = resolveExtra();
  const candidate = extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || null;

  if (!candidate) {
    console.warn('[auth] Supabase anon key missing. Configure EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return candidate || null;
}
