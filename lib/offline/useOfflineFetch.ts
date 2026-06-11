'use client'

import { useState, useEffect, useCallback } from 'react'
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

  const offlineFetch = useCallback(
    async (options: OfflineFetchOptions): Promise<OfflineFetchResult> => {
      // Sin conexión: encolar directamente y devolver resultado optimista
      if (!isOnline) {
        const op = await enqueue({ ...options, maxAttempts: 5 })
        setPendingCount(await countPending())
        return { ok: true, offline: true, localId: op.id, data: null }
      }

      try {
        const res = await fetch(options.endpoint, {
          method: options.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options.payload),
        })

        // Error de servidor (>= 500): no encolar, devolver error
        if (!res.ok && res.status >= 500) {
          const errData = await res.json().catch(() => ({}))
          return {
            ok: false,
            offline: false,
            error: (errData as { error?: string })?.error ?? `Error ${res.status}`,
          }
        }

        // Otro error HTTP (4xx, etc.): devolver error sin encolar
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
        // Error de red (sin conexión detectada por el navegador tras el intento)
        if (err instanceof TypeError && err.message.includes('fetch')) {
          const op = await enqueue({ ...options, maxAttempts: 5 })
          setPendingCount(await countPending())
          return { ok: true, offline: true, localId: op.id, data: null }
        }
        return { ok: false, offline: false, error: String(err) }
      }
    },
    [isOnline]
  )

  return { offlineFetch, pendingCount, isOnline }
}
