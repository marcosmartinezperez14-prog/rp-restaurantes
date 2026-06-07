'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CambiarPasswordPanel() {
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setError(null)
    setExito(false)
    if (nueva.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden'); return }

    setGuardando(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({ password: nueva })
      if (err) { setError(err.message); return }
      setExito(true)
      setNueva('')
      setConfirmar('')
    } catch {
      setError('Error al actualizar la contraseña')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6">
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Cambiar contraseña</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">Actualiza la contraseña de tu cuenta.</p>

      <div className="space-y-3 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={nueva}
            onChange={e => setNueva(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Confirmar contraseña</label>
          <input
            type="password"
            value={confirmar}
            onChange={e => setConfirmar(e.target.value)}
            placeholder="Repite la contraseña"
            onKeyDown={e => e.key === 'Enter' && handleGuardar()}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        {exito && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Contraseña actualizada correctamente
          </p>
        )}

        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
        >
          {guardando ? 'Actualizando...' : 'Actualizar contraseña'}
        </button>
      </div>
    </div>
  )
}
