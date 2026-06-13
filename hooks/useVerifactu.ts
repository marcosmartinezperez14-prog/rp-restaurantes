'use client'

import { useState, useCallback } from 'react'
import type { VerifactiRespuesta, EnviarFacturaOpciones } from '@/types/verifactu'

interface EstadoVerifactu {
  loading: boolean
  error: string | null
  resultado: VerifactiRespuesta | null
}

export function useVerifactu() {
  const [estado, setEstado] = useState<EstadoVerifactu>({
    loading: false,
    error:   null,
    resultado: null,
  })

  const enviarFactura = useCallback(async (
    ticketId: string,
    opciones: EnviarFacturaOpciones = { tipoFactura: 'F2' },
  ) => {
    setEstado({ loading: true, error: null, resultado: null })

    try {
      const res = await fetch('/api/verifactu/enviar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticketId, ...opciones }),
      })

      const json = await res.json() as { ok?: boolean; data?: VerifactiRespuesta; error?: string }

      if (!res.ok || json.error) {
        setEstado({ loading: false, error: json.error ?? 'Error al enviar', resultado: null })
        return null
      }

      setEstado({ loading: false, error: null, resultado: json.data ?? null })
      return json.data ?? null
    } catch {
      setEstado({ loading: false, error: 'Error de conexión', resultado: null })
      return null
    }
  }, [])

  return { ...estado, enviarFactura }
}
