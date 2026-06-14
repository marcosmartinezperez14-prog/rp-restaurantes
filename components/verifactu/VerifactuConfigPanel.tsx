'use client'

import { useState, useEffect } from 'react'

export default function VerifactuConfigPanel() {
  const [preview, setPreview] = useState<string | null>(null)
  const [configurada, setConfigurada] = useState(false)
  const [nuevaKey, setNuevaKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  useEffect(() => {
    fetch('/api/verifactu/config')
      .then(r => r.json())
      .then(d => { setConfigurada(d.configurada); setPreview(d.preview) })
      .finally(() => setLoading(false))
  }, [])

  async function handleGuardar() {
    if (!nuevaKey.trim()) return
    setSaving(true)
    setMensaje(null)
    const res = await fetch('/api/verifactu/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: nuevaKey.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      setConfigurada(true)
      setPreview(nuevaKey.trim().slice(0, 8) + '...')
      setNuevaKey('')
      setMensaje({ tipo: 'ok', texto: 'API key guardada correctamente' })
    } else {
      const d = await res.json()
      setMensaje({ tipo: 'error', texto: d.error ?? 'Error al guardar' })
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-bold text-[var(--text-primary)]">Verifactu</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          API key de Verifacti para el envío de facturas a la AEAT.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Cargando...</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              configurada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {configurada ? '✓ Configurada' : '⚠ No configurada'}
            </span>
            {configurada && preview && (
              <span className="text-xs text-[var(--text-secondary)] font-mono">{preview}</span>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              {configurada ? 'Cambiar API key' : 'Introducir API key'}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={nuevaKey}
                onChange={e => setNuevaKey(e.target.value)}
                placeholder="vf_live_..."
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-xl text-sm text-black outline-none focus:border-blue-400"
              />
              <button
                onClick={handleGuardar}
                disabled={saving || !nuevaKey.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {mensaje && (
            <p className={`text-sm ${mensaje.tipo === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {mensaje.texto}
            </p>
          )}
        </>
      )}
    </div>
  )
}
