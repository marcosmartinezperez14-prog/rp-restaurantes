'use client'

import { useState, useTransition } from 'react'
import type { Menu } from '@/app/actions/menus'
import type { MenuItem } from '@/app/actions/productos'
import { getMenus } from '@/app/actions/menus'
import MenuCard from './MenuCard'
import MenuForm from './MenuForm'
import MenuSectionEditor from './MenuSectionEditor'

interface Props {
  initialMenus: Menu[]
  allMenuItems: MenuItem[]
  canEdit: boolean
}

export default function MenusTab({ initialMenus, allMenuItems, canEdit }: Props) {
  const [menus, setMenus] = useState<Menu[]>(initialMenus)
  const [showForm, setShowForm] = useState(false)
  const [editMenu, setEditMenu] = useState<Menu | undefined>(undefined)
  const [sectionMenu, setSectionMenu] = useState<Menu | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      try {
        const fresh = await getMenus()
        setMenus(fresh)
      } catch { /* silencioso — los datos actuales permanecen */ }
    })
  }

  function handleEdit(menu: Menu) {
    setEditMenu(menu)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditMenu(undefined)
  }

  const activeMenus = menus.filter(m => m.is_active)
  const inactiveMenus = menus.filter(m => !m.is_active)

  return (
    <div style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity .2s' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: '#6b6f77' }}>
            {menus.length === 0
              ? 'Sin menús creados'
              : `${activeMenus.length} activo${activeMenus.length !== 1 ? 's' : ''} · ${menus.length} en total`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={refresh}
            disabled={isPending}
            style={{ height: 38, padding: '0 14px', border: '1.5px solid #e6e6e8', borderRadius: 10, background: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: '#4d5159', cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}
          >
            {isPending ? 'Actualizando...' : 'Actualizar'}
          </button>
          {canEdit && (
            <button
              onClick={() => { setEditMenu(undefined); setShowForm(true) }}
              style={{ height: 38, padding: '0 16px', border: 'none', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(22,135,106,0.22)' }}
            >
              + Nuevo menú
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {menus.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c2c4c9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5h18M3 12h18M3 19h18" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1b1e24', marginBottom: 6 }}>Sin menús</div>
          <div style={{ fontSize: 13, color: '#a7a9af', marginBottom: 20 }}>Crea tu primer menú del día o menú cerrado.</div>
          {canEdit && (
            <button
              onClick={() => setShowForm(true)}
              style={{ height: 40, padding: '0 20px', border: 'none', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              + Crear primer menú
            </button>
          )}
        </div>
      )}

      {/* Active menus */}
      {activeMenus.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#6b6f77', marginBottom: 10 }}>Activos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {activeMenus.map(m => (
              <MenuCard
                key={m.id}
                menu={m}
                canEdit={canEdit}
                onEdit={handleEdit}
                onManageSections={menu => setSectionMenu(menu)}
                onRefresh={refresh}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive menus */}
      {inactiveMenus.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#a7a9af', marginBottom: 10 }}>Inactivos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {inactiveMenus.map(m => (
              <MenuCard
                key={m.id}
                menu={m}
                canEdit={canEdit}
                onEdit={handleEdit}
                onManageSections={menu => setSectionMenu(menu)}
                onRefresh={refresh}
              />
            ))}
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <MenuForm
          menu={editMenu}
          onClose={handleFormClose}
          onSaved={refresh}
        />
      )}

      {/* Section editor panel */}
      {sectionMenu && (
        <MenuSectionEditor
          menu={sectionMenu}
          allMenuItems={allMenuItems}
          onClose={() => setSectionMenu(undefined)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
