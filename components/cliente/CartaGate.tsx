'use client'

import { useState } from 'react'

interface CartaGateProps {
  maxOnlineComensales: number | null
  children: React.ReactNode
}

export default function CartaGate({ maxOnlineComensales, children }: CartaGateProps) {
  const [confirmado, setConfirmado] = useState(false)
  const [comensales, setComensales] = useState(1)

  // Sin límite configurado → mostrar contenido directamente
  if (maxOnlineComensales === null) {
    return <>{children}</>
  }

  // Grupo demasiado grande para gestionar online
  if (confirmado && comensales >= maxOnlineComensales) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-6">
        <div className="text-5xl">📞</div>
        <p className="text-gray-800 text-base font-medium leading-relaxed">
          Para grupos de {maxOnlineComensales} o más personas, contacta con nosotros por teléfono.
        </p>
        <button
          onClick={() => setConfirmado(false)}
          className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Volver
        </button>
      </div>
    )
  }

  // Ya confirmó y el grupo cabe → mostrar carta
  if (confirmado) {
    return <>{children}</>
  }

  // Stepper: seleccionar número de comensales
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-8">
      <p className="text-xl font-bold text-gray-900">¿Cuántas personas sois?</p>

      <div className="flex items-center gap-6">
        <button
          onClick={() => setComensales(n => Math.max(1, n - 1))}
          aria-label="Menos comensales"
          className="w-11 h-11 rounded-full border border-gray-300 text-gray-700 text-xl font-bold flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-40"
          disabled={comensales <= 1}
        >
          −
        </button>

        <span className="text-3xl font-bold text-gray-900 w-8 text-center tabular-nums">
          {comensales}
        </span>

        <button
          onClick={() => setComensales(n => n + 1)}
          aria-label="Más comensales"
          className="w-11 h-11 rounded-full border border-gray-300 text-gray-700 text-xl font-bold flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          +
        </button>
      </div>

      <button
        onClick={() => setConfirmado(true)}
        className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        Continuar
      </button>
    </div>
  )
}
