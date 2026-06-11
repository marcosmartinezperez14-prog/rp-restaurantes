'use client'

import { useState, useEffect, useCallback } from 'react'
import { getFailed } from '@/lib/offline/db'
import { updateOperation, dequeue } from '@/lib/offline/db'
import { processQueue } from '@/lib/offline/syncQueue'
import type { PendingOperation } from '@/lib/offline/db'

interface FailedOperationsProps {
  onClose: () => void
}

export default function FailedOperations({ onClose }: FailedOperationsProps) {
  const [failed, setFailed] = useState<PendingOperation[]>([])
  const [processing, setProcessing] = useState(false)

  const loadFailed = useCallback(async () => {
    try {
      const ops = await getFailed()
      setFailed(ops)
    } catch (err) {
      console.error('[FailedOperations] Error al cargar operaciones fallidas:', err)
    }
  }, [])

  useEffect(() => {
    loadFailed()
  }, [loadFailed])

  const handleRetry = async (op: PendingOperation) => {
    setProcessing(true)
    try {
      await updateOperation(op.id, { status: 'pending', attempts: 0, errorMessage: undefined })
      await processQueue()
      await loadFailed()
    } catch (err) {
      console.error('[FailedOperations] Error al reintentar operación:', err)
    }
    setProcessing(false)
  }

  const handleRetryAll = async () => {
    setProcessing(true)
    try {
      for (const op of failed) {
        await updateOperation(op.id, { status: 'pending', attempts: 0, errorMessage: undefined })
      }
      await processQueue()
      await loadFailed()
    } catch (err) {
      console.error('[FailedOperations] Error al reintentar todas las operaciones:', err)
    }
    setProcessing(false)
  }

  const handleDiscard = async (op: PendingOperation) => {
    if (!window.confirm('¿Descartar esta operación? No se podrá recuperar.')) return
    setProcessing(true)
    try {
      await dequeue(op.id)
      await loadFailed()
    } catch (err) {
      console.error('[FailedOperations] Error al descartar operación:', err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Operaciones fallidas</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {failed.length === 0 ? (
            <p className="text-sm text-gray-500">No hay operaciones fallidas.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {failed.map(op => (
                <li key={op.id} className="border border-red-200 rounded-xl p-4 bg-red-50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{op.type}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(op.timestamp).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRetry(op)}
                        disabled={processing}
                        className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reintentar
                      </button>
                      <button
                        onClick={() => handleDiscard(op)}
                        disabled={processing}
                        className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                  {op.errorMessage && (
                    <p className="text-xs text-red-600 bg-white rounded-lg px-3 py-2 border border-red-100">
                      {op.errorMessage}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {failed.length > 0 && (
          <div className="p-5 border-t border-gray-200">
            <button
              onClick={handleRetryAll}
              disabled={processing}
              className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Procesando...' : `Reintentar todas (${failed.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
