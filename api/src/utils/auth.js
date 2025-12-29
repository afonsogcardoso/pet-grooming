import { getSupabaseClientWithAuth } from '../authClient.js'

export async function getAuthenticatedUser(req) {
  const supabase = getSupabaseClientWithAuth(req)
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}
