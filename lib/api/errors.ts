import { NextResponse } from 'next/server'

/**
 * Devuelve un error JSON SIN exponer detalles internos al cliente.
 * El mensaje real (p. ej. errores de Postgres con nombres de tablas/columnas)
 * se loguea en servidor; al cliente solo le llega un mensaje genérico.
 *
 * Uso: `return jsonError('No se pudo crear la reserva', 500, dbError)`
 */
export function jsonError(
  publicMessage: string,
  status: number,
  internal?: unknown,
): NextResponse {
  if (internal) {
    const detail = internal instanceof Error ? internal.message : String(internal)
    console.error(`[api ${status}] ${publicMessage}:`, detail)
  }
  return NextResponse.json({ error: publicMessage }, { status })
}
