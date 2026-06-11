'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { enqueue, countPending } from './db'
import type { OperationType } from './db'

// ---------------------------------------------------------------------------
// Interfaces públicas
// ---------------------------------------------------------------------------

interface OfflineFetchOptions {
  type: OperationType
  endpoint: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  payload: Record<string, unknown>
}

interface OfflineFetchResult {
  ok: boolean
  offline: boolean
  localId?: string
  data?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Helpers de módulo (fuera del hook para que sean puros y estables)
// ---------------------------------------------------------------------------

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false
  const msg = err.message
  return (
    msg === 'Failed to fetch' ||           // Chrome/Firefox
    msg === 'Load failed' ||               // Safari
    msg.toLowerCase().includes('network')  // fallback
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineFetch(): {
  offlineFetch: (options: OfflineFetchOptions) => Promise<OfflineFetchResult>
  pendingCount: number
  isOnline: boolean
} {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof window !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState<number>(0)

  // Ref para evitar que offlineFetch cambie de referencia cada vez que
  // isOnline cambia (I1: ref pattern → deps vacías en useCallback).
  const isOnlineRef = useRef(isOnline)
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  useEffect(() => {
    countPending().then(setPendingCount).catch(() => {})

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // m3: helper extraído para eliminar las dos ramas de encolado duplicadas.
  // I2: envuelto en try/catch para que un fallo de IndexedDB devuelva
  //     OfflineFetchResult en lugar de lanzar al consumidor.
  const enqueueAndCount = useCallback(
    async (options: OfflineFetchOptions): Promise<OfflineFetchResult> => {
      try {
        const op = await enqueue({ ...options, maxAttempts: 5 })
        setPendingCount(await countPending())
        return { ok: true, offline: true, localId: op.id, data: null }
      } catch {
        return { ok: false, offline: true, error: 'No se pudo encolar la operación' }
      }
    },
    []
  )

  const offlineFetch = useCallback(
    async (options: OfflineFetchOptions): Promise<OfflineFetchResult> => {
      // Sin conexión: encolar directamente y devolver resultado optimista
      if (!isOnlineRef.current) {
        return enqueueAndCount(options)
      }

      try {
        const res = await fetch(options.endpoint, {
          method: options.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options.payload),
        })

        // m4: ramas 5xx y 4xx unificadas en un solo !res.ok
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          return {
            ok: false,
            offline: false,
            error: (errData as { error?: string })?.error ?? `Error ${res.status}`,
          }
        }

        const data: unknown = await res.json()
        return { ok: true, offline: false, data }
      } catch (err) {
        // m5: sólo errores de red reales se encolan; otros TypeError se propagan
        if (isNetworkError(err)) {
          return enqueueAndCount(options)
        }
        return { ok: false, offline: false, error: String(err) }
      }
    },
    [enqueueAndCount] // referencia estable gracias a deps vacías en enqueueAndCount
  )

  return { offlineFetch, pendingCount, isOnline }
}
