import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { NextRequest } from 'next/server'

/**
 * IP del cliente a partir de las cabeceras de Vercel/proxy.
 * Cae a 'unknown' si no hay cabecera (no debería en producción).
 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Rate-limit de ventana deslizante respaldado por Postgres (RPC check_rate_limit).
 * Devuelve `true` si la petición está permitida, `false` si excede el límite.
 *
 * Fail-open: si la RPC falla (problema de infra), permite la petición para no
 * bloquear a usuarios legítimos; el error se loguea en servidor.
 */
export async function checkRateLimit(
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().rpc('check_rate_limit', {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error('[rate-limit] rpc error:', error.message)
    return true
  }

  return data === true
}
