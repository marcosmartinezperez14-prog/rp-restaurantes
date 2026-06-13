'use client'

import { useVerifactu } from '@/hooks/useVerifactu'
import type { EnviarFacturaOpciones } from '@/types/verifactu'

interface Props {
  ticketId: string
  verifactuStatus: string | null | undefined
  verifactuUrl: string | null | undefined
  opciones?: EnviarFacturaOpciones
}

export default function BotonVerifactu({
  ticketId,
  verifactuStatus,
  verifactuUrl,
  opciones = { tipoFactura: 'F2' },
}: Props) {
  const { loading, error, resultado, enviarFactura } = useVerifactu()

  const estadoActual = resultado?.estado ?? verifactuStatus ?? null
  const urlActual    = resultado?.url    ?? verifactuUrl    ?? null
  const yaEnviado    = estadoActual === 'Pendiente' || estadoActual === 'Correcto'

  function handleEnviar() {
    enviarFactura(ticketId, opciones)
  }

  function handleVerQR() {
    if (urlActual) window.open(urlActual, '_blank', 'noopener,noreferrer')
  }

  // Estado: enviado correctamente
  if (yaEnviado) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-sm font-semibold">
          <span>✓</span>
          <span>Enviado a Verifactu</span>
        </span>
        {urlActual && (
          <button
            onClick={handleVerQR}
            className="text-sm px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
          >
            Ver en AEAT
          </button>
        )}
      </div>
    )
  }

  // Estado: error
  if (error) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-semibold">
          <span>✕</span>
          <span>Error Verifactu</span>
        </span>
        <button
          onClick={handleEnviar}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Reintentar
        </button>
        <span className="text-xs text-red-500 w-full">{error}</span>
      </div>
    )
  }

  // Estado: pendiente de envío
  return (
    <button
      onClick={handleEnviar}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Enviando...</span>
        </>
      ) : (
        <>
          <span>📄</span>
          <span>Enviar a Verifactu</span>
        </>
      )}
    </button>
  )
}
