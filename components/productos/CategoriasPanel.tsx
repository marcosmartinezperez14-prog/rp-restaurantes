'use client'

import { useState, useTransition } from 'react'
import type { Categoria } from '@/app/actions/productos'
import { createCategoria, updateCategoria, deleteCategoria } from '@/app/actions/productos'

interface Props {
  categories: Categoria[]
  onClose: () => void
  onChanged: () => void
}

export default function CategoriasPanel({ categories, onClose, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [newError, setNewError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    if (!newName.trim()) { setNewError('El nombre es obligatorio'); return }
    setNewError(null)
    startTransition(async () => {
      const res = await createCategoria(newName.trim())
      if ('error' in res) { setNewError(res.error); return }
      setNewName('')
      onChanged()
    })
  }

  function startEdit(cat: Categoria) {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setRowError(prev => { const next = { ...prev }; delete next[cat.id]; return next })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName('')
  }

  function handleUpdate(id: string) {
    if (!editingName.trim()) {
      setRowError(prev => ({ ...prev, [id]: 'El nombre es obligatorio' }))
      return
    }
    startTransition(async () => {
      const res = await updateCategoria(id, editingName.trim())
      if (res.error) { setRowError(prev => ({ ...prev, [id]: res.error! })); return }
      setEditingId(null)
      onChanged()
    })
  }

  function handleDelete(id: string) {
    setRowError(prev => { const next = { ...prev }; delete next[id]; return next })
    startTransition(async () => {
      const res = await deleteCategoria(id)
      if (res.error) { setRowError(prev => ({ ...prev, [id]: res.error! })); return }
      onChanged()
    })
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[440px] bg-[var(--bg-surface)] shadow-2xl z-50 flex flex-col">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Categorías</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Nueva categoría */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Nueva categoría</p>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Nombre de la categoría"
                className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-blue-400"
              />
              <button
                onClick={handleCreate}
                disabled={isPending}
                className="px-3 py-2 text-sm bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 whitespace-nowrap"
              >
                Añadir
              </button>
            </div>
            {newError && <p className="text-red-600 text-xs mt-1">{newError}</p>}
          </div>

          {/* Lista */}
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
              {categories.length} categoría{categories.length !== 1 ? 's' : ''}
            </p>
            {categories.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)] py-4 text-center">Sin categorías</p>
            )}
            {categories.map(cat => (
              <div key={cat.id} className="flex flex-col">
                {editingId === cat.id ? (
                  <div className="flex gap-2 py-1.5">
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleUpdate(cat.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                      className="flex-1 border border-blue-400 rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none"
                    />
                    <button
                      onClick={() => handleUpdate(cat.id)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white font-semibold rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-2 px-1 rounded-lg group hover:bg-[var(--bg-page)]">
                    <span className="flex-1 text-sm text-[var(--text-primary)]">{cat.name}</span>
                    <button
                      onClick={() => startEdit(cat)}
                      className="px-2.5 py-1 text-xs border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={isPending}
                      className="px-2.5 py-1 text-xs border border-red-100 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
                {rowError[cat.id] && (
                  <p className="text-red-600 text-xs pb-1 pl-1">{rowError[cat.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
