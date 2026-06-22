'use client'

import { useState } from 'react'
import type { Menu } from '@/app/actions/menus'
import { toggleMenuActive, deleteMenu } from '@/app/actions/menus'

interface Props {
  menu: Menu
  canEdit: boolean
  onEdit: (menu: Menu) => void
  onManageSections: (menu: Menu) => void
  onRefresh: () => void
}

export default function MenuCard({ menu, canEdit, onEdit, onManageSections, onRefresh }: Props) {
  const [active, setActive] = useState(menu.is_active)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleToggle() {
    setToggling(true)
    const newActive = !active
    setActive(newActive)
    await toggleMenuActive(menu.id, newActive)
    setToggling(false)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el menú "${menu.name}"? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    await deleteMenu(menu.id)
    onRefresh()
  }

  const isDelDia = menu.tipo === 'menu_del_dia'
  const totalPlatos = menu.sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div style={{
      background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16,
      padding: '18px 20px', boxShadow: '0 1px 3px rgba(20,23,29,0.05)',
      opacity: deleting ? 0.5 : 1, transition: 'opacity .2s',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        {/* Icon */}
        <div style={{ width: 40, height: 40, borderRadius: 11, background: isDelDia ? 'rgba(234,179,8,0.12)' : 'rgba(22,135,106,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDelDia ? '#ca8a04' : 'var(--accent)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18M3 12h18M3 19h18" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              color: isDelDia ? '#ca8a04' : 'var(--accent)',
              background: isDelDia ? 'rgba(234,179,8,0.10)' : 'rgba(22,135,106,0.09)',
              padding: '2px 7px', borderRadius: 999,
            }}>
              {isDelDia ? 'Menú del día' : 'Menú cerrado'}
            </span>
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1b1e24', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{menu.name}</h3>
          {menu.description && (
            <p style={{ fontSize: 12, color: '#6b6f77', margin: '3px 0 0', lineHeight: 1.4 }}>{menu.description}</p>
          )}
        </div>

        {/* Toggle activo */}
        {canEdit && (
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={active ? 'Desactivar menú' : 'Activar menú'}
            style={{
              width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: active ? 'var(--accent)' : '#d1d5db',
              position: 'relative', transition: 'background .15s',
              opacity: toggling ? 0.6 : 1,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: active ? 20 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left .15s', display: 'block',
            }} />
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#a7a9af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Precio</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 700, color: '#1b1e24' }}>{menu.price.toFixed(2)} €</div>
        </div>
        <div style={{ borderLeft: '1px solid #f0f0f1', paddingLeft: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#a7a9af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Secciones</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 700, color: '#1b1e24' }}>{menu.sections.length}</div>
        </div>
        <div style={{ borderLeft: '1px solid #f0f0f1', paddingLeft: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#a7a9af', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Platos</div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 18, fontWeight: 700, color: '#1b1e24' }}>{totalPlatos}</div>
        </div>
        {!active && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#a7a9af', background: '#f4f4f5', border: '1px solid #e9e9eb', borderRadius: 999, padding: '3px 10px' }}>Inactivo</span>
          </div>
        )}
      </div>

      {/* Sections preview */}
      {menu.sections.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {menu.sections.map(s => (
            <span key={s.id} style={{ fontSize: 11, fontWeight: 600, color: '#4d5159', background: '#f4f4f5', border: '1px solid #ebebed', borderRadius: 8, padding: '3px 9px' }}>
              {s.name} ({s.items.length})
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f2f2f3', paddingTop: 12 }}>
          <button
            onClick={() => onManageSections(menu)}
            style={{ flex: 1, height: 36, border: '1.5px solid var(--accent)', borderRadius: 9, background: 'rgba(22,135,106,0.06)', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Gestionar secciones
          </button>
          <button
            onClick={() => onEdit(menu)}
            style={{ height: 36, padding: '0 14px', border: '1.5px solid #e6e6e8', borderRadius: 9, background: '#fff', color: '#4d5159', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ height: 36, padding: '0 14px', border: '1.5px solid #fecaca', borderRadius: 9, background: '#fef2f2', color: '#c0492f', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}
          >
            Eliminar
          </button>
        </div>
      )}

      {/* TODO: integrar menús en TPV como línea de ticket al precio del menú */}
    </div>
  )
}
