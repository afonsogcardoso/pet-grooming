import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const envResult = dotenv.config({ path: '.env.local' })
if (envResult.error) {
  dotenv.config()
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getSupabaseClientWithAuth(req) {
  const token = req.headers.authorization
  if (!token) return null

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars')
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: token } }
  })
}

export function getSupabaseServiceRoleClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
