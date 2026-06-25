'use client'

import { useState } from 'react'
import type { Menu } from '@/app/actions/menus'
import { createMenu, updateMenu } from '@/app/actions/menus'

interface Props {
  menu?: Menu
  onClose: () => void
  onSaved: () => void
}

export default function MenuForm({ menu, onClose, onSaved }: Props) {
  const isEditing = !!menu

  const [name, setName] = useState(menu?.name ?? '')
  const [tipo, setTipo] = useState<'cerrado' | 'menu_del_dia'>(menu?.tipo ?? 'cerrado')
  const [price, setPrice] = useState(menu?.price.toFixed(2) ?? '0.00')
  const [description, setDescription] = useState(menu?.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    const priceNum = parseFloat(price.replace(',', '.'))
    if (isNaN(priceNum) || priceNum < 0) { setError('Precio no válido'); return }

    setLoading(true)
    setError(null)

    try {
      const res = isEditing
        ? await updateMenu(menu.id, { name, tipo, price: priceNum, description: description || null })
        : await createMenu({ name, tipo, price: priceNum, description: description || undefined })

      if ('error' in res && res.error) { setError(res.error); return }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', border: '1.5px solid #e6e6e8', borderRadius: 10,
    padding: '10px 14px', fontSize: 14, color: '#1b1e24', background: '#fcfcfd',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#4d5159',
    letterSpacing: '0.1px', marginBottom: 6,
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 24 }}
    >
      <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(20,23,29,0.18)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: '#a7a9af', textTransform: 'uppercase', marginBottom: 2 }}>
              {isEditing ? 'EDITAR MENÚ' : 'NUEVO MENÚ'}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1b1e24', margin: 0 }}>
              {isEditing ? menu.name : 'Crear menú'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e6e6e8', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6f77', fontSize: 16 }}
          >✕</button>
        </div>

        {/* Tipo */}
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Tipo de menú</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { value: 'cerrado', label: 'Menú cerrado', desc: 'Platos fijos' },
              { value: 'menu_del_dia', label: 'Menú del día', desc: 'Platos rotativos' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setTipo(opt.value)}
                style={{
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: tipo === opt.value ? '2px solid var(--accent)' : '1.5px solid #e6e6e8',
                  background: tipo === opt.value ? 'rgba(22,135,106,0.06)' : '#fcfcfd',
                  transition: 'all .12s',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: tipo === opt.value ? 'var(--accent)' : '#1b1e24' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#a7a9af', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={labelStyle}>Nombre *</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Menú del día, Menú degustación..."
            style={inputStyle}
            autoFocus
          />
        </label>

        {/* Precio */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={labelStyle}>Precio (€)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            style={inputStyle}
          />
        </label>

        {/* Descripción */}
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={labelStyle}>Descripción <span style={{ fontWeight: 400, color: '#a7a9af' }}>(opcional)</span></span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Descripción breve del menú..."
            style={{ ...inputStyle, resize: 'none' }}
          />
        </label>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 44, border: '1.5px solid #e6e6e8', borderRadius: 10, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#4d5159', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              flex: 1, height: 44, border: 'none', borderRadius: 10,
              background: 'var(--accent)', color: '#fff', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1, boxShadow: '0 4px 12px rgba(22,135,106,0.22)',
            }}
          >
            {loading ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear menú'}
          </button>
        </div>
      </div>
    </div>
  )
}
