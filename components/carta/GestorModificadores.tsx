'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ModifierGroup, ModifierOption } from '@/types/modificadores'

interface Props {
  menuItemId: string
  menuItemName: string
}

type FormGrupo = {
  name: string
  type: 'variante' | 'modificador'
  required: boolean
  allows_multiple: boolean
}

type FormOpcion = {
  name: string
  price_delta: string
  is_default: boolean
}

const FORM_GRUPO_VACIO: FormGrupo = { name: '', type: 'modificador', required: false, allows_multiple: false }
const FORM_OPCION_VACIO: FormOpcion = { name: '', price_delta: '0', is_default: false }

export default function GestorModificadores({ menuItemId, menuItemName }: Props) {
  const [grupos, setGrupos] = useState<ModifierGroup[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal añadir grupo
  const [modalGrupo, setModalGrupo] = useState(false)
  const [formGrupo, setFormGrupo] = useState<FormGrupo>(FORM_GRUPO_VACIO)
  const [guardandoGrupo, setGuardandoGrupo] = useState(false)
  const [errorGrupo, setErrorGrupo] = useState<string | null>(null)

  // Modal añadir opción
  const [modalOpcion, setModalOpcion] = useState<{ groupId: string; groupName: string; groupType: 'variante' | 'modificador' } | null>(null)
  const [formOpcion, setFormOpcion] = useState<FormOpcion>(FORM_OPCION_VACIO)
  const [guardandoOpcion, setGuardandoOpcion] = useState(false)
  const [errorOpcion, setErrorOpcion] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/modificadores/${menuItemId}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setGrupos(json.data ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setCargando(false)
    }
  }, [menuItemId])

  useEffect(() => { cargar() }, [cargar])

  async function handleCrearGrupo() {
    if (!formGrupo.name.trim()) { setErrorGrupo('El nombre es obligatorio'); return }
    setGuardandoGrupo(true)
    setErrorGrupo(null)
    try {
      const res = await fetch('/api/modificadores/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_item_id: menuItemId,
          name: formGrupo.name.trim(),
          type: formGrupo.type,
          required: formGrupo.required,
          allows_multiple: formGrupo.type === 'variante' ? false : formGrupo.allows_multiple,
          sort_order: grupos.length,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setModalGrupo(false)
      setFormGrupo(FORM_GRUPO_VACIO)
      await cargar()
    } catch (e) {
      setErrorGrupo(String(e))
    } finally {
      setGuardandoGrupo(false)
    }
  }

  async function handleEliminarGrupo(grupoId: string) {
    if (!confirm('¿Eliminar este grupo y todas sus opciones?')) return
    await fetch(`/api/modificadores/grupos/${grupoId}`, { method: 'DELETE' })
    await cargar()
  }

  async function handleCrearOpcion() {
    if (!modalOpcion) return
    if (!formOpcion.name.trim()) { setErrorOpcion('El nombre es obligatorio'); return }
    const delta = parseFloat(formOpcion.price_delta)
    if (isNaN(delta) || delta < 0) { setErrorOpcion('El precio debe ser un número positivo'); return }

    const grupo = grupos.find(g => g.id === modalOpcion.groupId)
    setGuardandoOpcion(true)
    setErrorOpcion(null)
    try {
      const res = await fetch('/api/modificadores/opciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: modalOpcion.groupId,
          name: formOpcion.name.trim(),
          price_delta: delta,
          is_default: formOpcion.is_default,
          sort_order: (grupo?.options.length ?? 0),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setModalOpcion(null)
      setFormOpcion(FORM_OPCION_VACIO)
      await cargar()
    } catch (e) {
      setErrorOpcion(String(e))
    } finally {
      setGuardandoOpcion(false)
    }
  }

  async function handleEliminarOpcion(opcionId: string) {
    await fetch(`/api/modificadores/opciones/${opcionId}`, { method: 'DELETE' })
    await cargar()
  }

  const inputClass = 'border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400 w-full'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          Variantes y modificadores
        </span>
        <button
          onClick={() => { setFormGrupo(FORM_GRUPO_VACIO); setErrorGrupo(null); setModalGrupo(true) }}
          className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Añadir grupo
        </button>
      </div>

      {cargando && (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!cargando && grupos.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] text-center py-3">
          Sin grupos de variantes. Añade uno para personalizar el plato.
        </p>
      )}

      {grupos.map(grupo => (
        <div key={grupo.id} className="border border-[var(--border)] rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{grupo.name}</span>
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${grupo.type === 'variante' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {grupo.type}
              </span>
              {grupo.required && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">
                  Obligatorio
                </span>
              )}
              {grupo.type === 'modificador' && grupo.allows_multiple && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold bg-green-100 text-green-700">
                  Multi
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => {
                  setFormOpcion(FORM_OPCION_VACIO)
                  setErrorOpcion(null)
                  setModalOpcion({ groupId: grupo.id, groupName: grupo.name, groupType: grupo.type })
                }}
                className="text-xs px-2 py-1 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-gray-50"
              >
                + Opción
              </button>
              <button
                onClick={() => handleEliminarGrupo(grupo.id)}
                className="text-xs px-2 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </div>

          {grupo.options.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)] pl-1">Sin opciones aún.</p>
          )}

          <div className="flex flex-col gap-1">
            {grupo.options.map(opcion => (
              <div key={opcion.id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                <span className="text-xs text-[var(--text-primary)] flex-1">{opcion.name}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {opcion.price_delta > 0
                    ? (grupo.type === 'variante' ? `${Number(opcion.price_delta).toFixed(2)} €` : `+${Number(opcion.price_delta).toFixed(2)} €`)
                    : '—'}
                </span>
                {opcion.is_default && (
                  <span className="text-[10px] text-blue-600 font-semibold">Por defecto</span>
                )}
                <button
                  onClick={() => handleEliminarOpcion(opcion.id)}
                  className="text-red-400 hover:text-red-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal crear grupo */}
      {modalGrupo && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalGrupo(false) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4">
            <h3 className="font-bold text-[var(--text-primary)]">Nuevo grupo de variante / modificador</h3>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Nombre del grupo *</span>
              <input value={formGrupo.name} onChange={e => setFormGrupo(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Tamaño, Punto de la carne, Extras" className={inputClass} />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Tipo</span>
              <div className="flex gap-2">
                {(['variante', 'modificador'] as const).map(t => (
                  <button key={t} onClick={() => setFormGrupo(p => ({ ...p, type: t }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${formGrupo.type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-blue-400'}`}>
                    {t === 'variante' ? 'Variante (con precio)' : 'Modificador (suplemento)'}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formGrupo.required}
                onChange={e => setFormGrupo(p => ({ ...p, required: e.target.checked }))}
                className="accent-blue-600" />
              <span className="text-sm text-[var(--text-primary)]">Obligatorio</span>
            </label>

            {formGrupo.type === 'modificador' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formGrupo.allows_multiple}
                  onChange={e => setFormGrupo(p => ({ ...p, allows_multiple: e.target.checked }))}
                  className="accent-blue-600" />
                <span className="text-sm text-[var(--text-primary)]">Selección múltiple</span>
              </label>
            )}

            {errorGrupo && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorGrupo}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalGrupo(false)}
                className="flex-1 py-2 text-sm border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCrearGrupo} disabled={guardandoGrupo}
                className="flex-1 py-2 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {guardandoGrupo ? 'Guardando...' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal añadir opción */}
      {modalOpcion && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpcion(null) }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 flex flex-col gap-4">
            <h3 className="font-bold text-[var(--text-primary)]">
              Nueva opción — {modalOpcion.groupName}
            </h3>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Nombre *</span>
              <input value={formOpcion.name} onChange={e => setFormOpcion(p => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Caña, Sin cebolla, Muy hecho" className={inputClass} />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {modalOpcion.groupType === 'variante' ? 'Precio completo (€)' : 'Suplemento (€, 0 si no tiene coste)'}
              </span>
              <input type="number" step="0.01" min="0" value={formOpcion.price_delta}
                onChange={e => setFormOpcion(p => ({ ...p, price_delta: e.target.value }))}
                className={inputClass} />
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formOpcion.is_default}
                onChange={e => setFormOpcion(p => ({ ...p, is_default: e.target.checked }))}
                className="accent-blue-600" />
              <span className="text-sm text-[var(--text-primary)]">Opción por defecto</span>
            </label>

            {errorOpcion && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorOpcion}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setModalOpcion(null)}
                className="flex-1 py-2 text-sm border border-[var(--border)] rounded-xl text-[var(--text-secondary)] hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCrearOpcion} disabled={guardandoOpcion}
                className="flex-1 py-2 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {guardandoOpcion ? 'Guardando...' : 'Añadir opción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
