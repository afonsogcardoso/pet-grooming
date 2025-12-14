import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isProd = process.env.NODE_ENV === 'production'
const globalForSupabase = globalThis

// Avoid re-creating clients on HMR and tone down auth chatter in dev
export const supabase =
  globalForSupabase.supabase ||
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false, // we start/stop manually to avoid refresh loops
      detectSessionInUrl: false
    }
  })

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabase = supabase
}
