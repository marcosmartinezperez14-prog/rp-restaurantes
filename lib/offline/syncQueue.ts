/**
 * lib/offline/syncQueue.ts
 * Procesador de cola offline — módulo puro sin hooks de React.
 * Gestiona el retry de operaciones pendientes cuando hay conexión disponible.
 */

import { getPending, updateOperation, dequeue } from './db'

// ---------------------------------------------------------------------------
// processQueue
// ---------------------------------------------------------------------------

/**
 * Procesa todas las operaciones pendientes en IndexedDB.
 * Las intenta en orden cronológico (la más antigua primero).
 * Implementa retry con maxAttempts por operación.
 *
 * Guard SSR: retorna { processed: 0, failed: 0 } si no hay window o no hay
 * conexión de red.
 */
export async function processQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0

  let pending
  try {
    pending = await getPending()
  } catch (err) {
    console.error('[syncQueue] Error al obtener operaciones pendientes:', err)
    return { processed: 0, failed: 0 }
  }

  for (const op of pending) {
    try {
      await updateOperation(op.id, { status: 'processing' })

      const res = await fetch(op.endpoint, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.payload),
      })

      if (res.ok) {
        await dequeue(op.id)
        processed++
      } else {
        let body = ''
        try { body = await res.text() } catch { /* ignorar */ }
        const errorMessage = `HTTP ${res.status}${body ? ': ' + body.slice(0, 200) : ''}`
        if (op.attempts + 1 < op.maxAttempts) {
          await updateOperation(op.id, {
            attempts: op.attempts + 1,
            status: 'pending',
            errorMessage,
          })
        } else {
          await updateOperation(op.id, { status: 'failed', errorMessage })
          failed++
        }
      }
    } catch (err) {
      console.error(`[syncQueue] Error procesando operación ${op.id}:`, err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      try {
        if (op.attempts + 1 < op.maxAttempts) {
          await updateOperation(op.id, {
            attempts: op.attempts + 1,
            status: 'pending',
            errorMessage,
          })
        } else {
          await updateOperation(op.id, { status: 'failed', errorMessage })
          failed++
        }
      } catch (updateErr) {
        console.error('[syncQueue] Error al actualizar estado de operación:', updateErr)
      }
    }
  }

  return { processed, failed }
}

// ---------------------------------------------------------------------------
// startSyncListener
// ---------------------------------------------------------------------------

/**
 * Registra un listener para el evento 'online' del navegador.
 * Cuando se recupera la conexión, espera 2 segundos y procesa la cola.
 *
 * Guard SSR: retorna un cleanup no-op si no hay window disponible.
 *
 * @returns Función de cleanup que elimina el listener y cancela el timeout.
 */
export function startSyncListener(): () => void {
  if (typeof window === 'undefined') return () => {}

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function handleOnline() {
    if (timeoutId !== null) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      processQueue().catch((err) => {
        console.error('[syncQueue] Error al procesar cola tras reconexión:', err)
      })
    }, 2000)
  }

  window.addEventListener('online', handleOnline)

  return () => {
    window.removeEventListener('online', handleOnline)
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}
