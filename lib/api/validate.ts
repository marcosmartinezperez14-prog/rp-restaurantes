import { NextResponse } from 'next/server'
import type { z } from 'zod'

/**
 * Valida un body contra un schema zod.
 * - En rutas (Route Handlers): usa `parseBody`, que devuelve una `NextResponse`
 *   400 lista para retornar cuando los datos no son válidos.
 * - En Server Actions: usa `parseInput`, que devuelve `{ error }` para el shape
 *   habitual de las actions.
 */

export type RouteParse<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

export function parseBody<T>(schema: z.ZodType<T>, input: unknown): RouteParse<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? 'Datos no válidos'
    return { ok: false, response: NextResponse.json({ error: msg }, { status: 400 }) }
  }
  return { ok: true, data: result.data }
}

export type ActionParse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): ActionParse<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? 'Datos no válidos' }
  }
  return { ok: true, data: result.data }
}
