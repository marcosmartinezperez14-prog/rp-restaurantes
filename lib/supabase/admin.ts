import { createClient } from '@supabase/supabase-js'

let _admin: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase admin env vars missing')
    _admin = createClient(url, key)
  }
  return _admin
}

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop]
  },
})
