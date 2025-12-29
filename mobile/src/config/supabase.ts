import Constants from 'expo-constants';

function resolveExtra() {
  return (
    Constants.expoConfig?.extra ||
    Constants.manifest?.extra ||
    // @ts-expect-error manifest2 is undocumented but present on some builds
    Constants.manifest2?.extra ||
    // @ts-expect-error manifestExtra is new on SDK 54+
    Constants.manifestExtra
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
