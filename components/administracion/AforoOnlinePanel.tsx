'use client'

import { useState, useTransition } from 'react'
import { guardarAforoOnline } from '@/app/actions/administracion'

export default function AforoOnlinePanel({ initialMax }: { initialMax: number | null }) {
  const [valor, setValor] = useState<string>(initialMax !== null ? String(initialMax) : '')
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGuardar() {
    setError(null)
    setGuardado(false)
    const parsed = valor.trim() === '' ? null : Number(valor)
    const max = parsed === null || parsed === 0 ? null : parsed
    startTransition(async () => {
      const res = await guardarAforoOnline(max)
      if (res.error) { setError(res.error); return }
      setGuardado(true)
    })
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">Aforo online</h2>

      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Máximo de comensales por reserva online</p>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          A partir de este número de comensales, los clientes deberán contactar por teléfono para reservar o pedir.
        </p>
        <input
          type="number"
          min={1}
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Sin límite"
          className="w-32 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}
      {guardado && (
        <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">Límite guardado</p>
      )}

      {/* Botón guardar */}
      <button
        onClick={handleGuardar}
        disabled={isPending}
        className="w-full py-2.5 bg-[var(--accent)] text-white font-semibold rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors text-sm"
      >
        {isPending ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  )
}
