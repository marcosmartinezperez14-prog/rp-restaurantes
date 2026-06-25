'use client'

import { useState } from 'react'
import type { Menu, MenuSection, MenuSectionItem } from '@/app/actions/menus'
import type { MenuItem } from '@/app/actions/productos'
import {
  createMenuSection, updateMenuSection, deleteMenuSection, reorderMenuSections,
  addMenuSectionItem, addMenuSectionCustomItem, removeMenuSectionItem, toggleMenuSectionItem,
} from '@/app/actions/menus'

interface Props {
  menu: Menu
  allMenuItems: MenuItem[]
  onClose: () => void
  onSaved: () => void
}

export default function MenuSectionEditor({ menu, allMenuItems, onClose, onSaved }: Props) {
  const [sections, setSections] = useState<MenuSection[]>(menu.sections)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionSeleccion, setNewSectionSeleccion] = useState(true)
  const [addingSectionLoading, setAddingSectionLoading] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [openSectionId, setOpenSectionId] = useState<string | null>(sections[0]?.id ?? null)
  const [itemSearches, setItemSearches] = useState<Record<string, string>>({})
  const [customNames, setCustomNames] = useState<Record<string, string>>({})
  const [addingItem, setAddingItem] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const isMenuDelDia = menu.tipo === 'menu_del_dia'

  async function handleAddSection() {
    if (!newSectionName.trim()) return
    setAddingSectionLoading(true)
    const res = await createMenuSection(menu.id, newSectionName.trim(), newSectionSeleccion)
    setAddingSectionLoading(false)
    if ('error' in res) { setError(res.error); return }
    const newSection: MenuSection = { id: res.id, menu_id: menu.id, name: newSectionName.trim(), sort_order: sections.length, seleccion: newSectionSeleccion, items: [] }
    setSections(prev => [...prev, newSection])
    setNewSectionName('')
    setNewSectionSeleccion(true)
    setOpenSectionId(res.id)
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm('¿Eliminar esta sección y todos sus platos?')) return
    const res = await deleteMenuSection(sectionId)
    if (res.error) { setError(res.error); return }
    setSections(prev => prev.filter(s => s.id !== sectionId))
    if (openSectionId === sectionId) setOpenSectionId(null)
  }

  async function handleRenameSection(sectionId: string) {
    if (!editingSectionName.trim()) return
    const res = await updateMenuSection(sectionId, { name: editingSectionName.trim() })
    if (res.error) { setError(res.error); return }
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, name: editingSectionName.trim() } : s))
    setEditingSectionId(null)
  }

  async function handleToggleSeleccion(sectionId: string, seleccion: boolean) {
    const res = await updateMenuSection(sectionId, { seleccion })
    if (res.error) { setError(res.error); return }
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, seleccion } : s))
  }

  async function handleMoveSection(idx: number, dir: -1 | 1) {
    const newSections = [...sections]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= newSections.length) return
    ;[newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]]
    const reordered = newSections.map((s, i) => ({ ...s, sort_order: i }))
    setSections(reordered)
    await reorderMenuSections(reordered.map(s => ({ id: s.id, sort_order: s.sort_order })))
  }

  async function handleAddItem(section: MenuSection, menuItemId: string) {
    setAddingItem(prev => ({ ...prev, [section.id]: true }))
    const res = await addMenuSectionItem(section.id, menuItemId)
    setAddingItem(prev => ({ ...prev, [section.id]: false }))
    if ('error' in res) { setError(res.error); return }
    const found = allMenuItems.find(m => m.id === menuItemId)
    const newItem: MenuSectionItem = {
      id: res.id, section_id: section.id, menu_item_id: menuItemId, custom_name: null,
      is_active: true, sort_order: section.items.length,
      menu_item: found ? { id: found.id, name: found.name, price: found.price } : null,
    }
    setSections(prev => prev.map(s => s.id === section.id ? { ...s, items: [...s.items, newItem] } : s))
    setItemSearches(prev => ({ ...prev, [section.id]: '' }))
  }

  async function handleAddCustomItem(section: MenuSection) {
    const name = (customNames[section.id] ?? '').trim()
    if (!name) return
    setAddingItem(prev => ({ ...prev, [section.id]: true }))
    const res = await addMenuSectionCustomItem(section.id, name)
    setAddingItem(prev => ({ ...prev, [section.id]: false }))
    if ('error' in res) { setError(res.error); return }
    const newItem: MenuSectionItem = {
      id: res.id, section_id: section.id, menu_item_id: null, custom_name: name,
      is_active: true, sort_order: section.items.length, menu_item: null,
    }
    setSections(prev => prev.map(s => s.id === section.id ? { ...s, items: [...s.items, newItem] } : s))
    setCustomNames(prev => ({ ...prev, [section.id]: '' }))
  }

  async function handleRemoveItem(sectionId: string, itemId: string) {
    const res = await removeMenuSectionItem(itemId)
    if (res.error) { setError(res.error); return }
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s))
  }

  async function handleToggleItem(sectionId: string, itemId: string, is_active: boolean) {
    const res = await toggleMenuSectionItem(itemId, is_active)
    if (res.error) { setError(res.error); return }
    setSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, is_active } : i) }
      : s
    ))
  }

  function getAvailableItems(section: MenuSection) {
    const usedIds = new Set(section.items.map(i => i.menu_item_id))
    const search = (itemSearches[section.id] ?? '').toLowerCase()
    return allMenuItems.filter(m => !usedIds.has(m.id) && (!search || m.name.toLowerCase().includes(search)))
  }

  const inputStyle: React.CSSProperties = {
    border: '1.5px solid #e6e6e8', borderRadius: 10, padding: '8px 12px',
    fontSize: 13, color: '#1b1e24', background: '#fcfcfd', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) { onSaved(); onClose() } }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)' }}
    >
      <div style={{ background: '#f6f6f7', width: '100%', maxWidth: 520, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(20,23,29,0.18)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e8e8ea', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: '#a7a9af', textTransform: 'uppercase' }}>SECCIONES DEL MENÚ</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1b1e24', margin: '2px 0 0' }}>{menu.name}</h2>
          </div>
          <button
            onClick={() => { onSaved(); onClose() }}
            style={{ width: 34, height: 34, borderRadius: 9, border: '1.5px solid #e6e6e8', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6f77', fontSize: 17 }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 32px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
              {error}
            </div>
          )}

          {/* Add section */}
          <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#6b6f77', marginBottom: 10 }}>Nuevo pase</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                placeholder="Ej: Entrantes, Primer plato, Postre..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleAddSection}
                disabled={addingSectionLoading || !newSectionName.trim()}
                style={{
                  height: 38, padding: '0 16px', border: 'none', borderRadius: 10,
                  background: 'var(--accent)', color: '#fff', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: addingSectionLoading || !newSectionName.trim() ? 0.5 : 1,
                }}
              >
                {addingSectionLoading ? '...' : '+ Añadir'}
              </button>
            </div>
            {/* Selección toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#f8f8f9', borderRadius: 9, border: '1px solid #efefef' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#25282f' }}>Con selección</div>
                <div style={{ fontSize: 11, color: '#a7a9af', marginTop: 1 }}>El cliente elige un plato de este pase</div>
              </div>
              <button
                type="button"
                onClick={() => setNewSectionSeleccion(v => !v)}
                style={{ width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: newSectionSeleccion ? 'var(--accent)' : '#d1d5db', position: 'relative', transition: 'background .15s' }}
              >
                <span style={{ position: 'absolute', top: 3, left: newSectionSeleccion ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s', display: 'block' }} />
              </button>
            </div>
          </div>

          {/* Sections list */}
          {sections.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#a7a9af', fontSize: 13 }}>
              Crea la primera sección para organizar los platos del menú.
            </div>
          )}

          {sections.map((section, idx) => {
            const isOpen = openSectionId === section.id
            const available = getAvailableItems(section)

            return (
              <div key={section.id} style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: isOpen ? '1px solid #f0f0f1' : 'none' }}>
                  {/* Order buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => handleMoveSection(idx, -1)} disabled={idx === 0}
                      style={{ width: 20, height: 18, border: '1px solid #e6e6e8', borderRadius: 4, background: '#fafafa', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontSize: 9, lineHeight: 1 }}>▲</button>
                    <button onClick={() => handleMoveSection(idx, 1)} disabled={idx === sections.length - 1}
                      style={{ width: 20, height: 18, border: '1px solid #e6e6e8', borderRadius: 4, background: '#fafafa', cursor: idx === sections.length - 1 ? 'default' : 'pointer', opacity: idx === sections.length - 1 ? 0.3 : 1, fontSize: 9, lineHeight: 1 }}>▼</button>
                  </div>

                  {editingSectionId === section.id ? (
                    <input
                      value={editingSectionName}
                      onChange={e => setEditingSectionName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameSection(section.id); if (e.key === 'Escape') setEditingSectionId(null) }}
                      autoFocus
                      style={{ ...inputStyle, flex: 1, padding: '5px 10px' }}
                    />
                  ) : (
                    <button
                      onClick={() => setOpenSectionId(isOpen ? null : section.id)}
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1b1e24' }}>{section.name}</span>
                      <span style={{ fontSize: 12, color: '#a7a9af', marginLeft: 8 }}>{section.items.length} platos</span>
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {/* Selección badge + toggle */}
                    {editingSectionId !== section.id && (
                      <button
                        type="button"
                        onClick={() => handleToggleSeleccion(section.id, !section.seleccion)}
                        title={section.seleccion ? 'Con selección (pulsa para desactivar)' : 'Sin selección (pulsa para activar)'}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, border: `1px solid ${section.seleccion ? 'var(--accent)' : '#d1d5db'}`, background: section.seleccion ? 'rgba(22,135,106,0.07)' : '#f4f4f5', cursor: 'pointer' }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: section.seleccion ? 'var(--accent)' : '#a7a9af', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: section.seleccion ? 'var(--accent)' : '#82858d', letterSpacing: '0.2px' }}>
                          {section.seleccion ? 'Selección' : 'Fijo'}
                        </span>
                      </button>
                    )}
                    {editingSectionId === section.id ? (
                      <>
                        <button onClick={() => handleRenameSection(section.id)}
                          style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>Guardar</button>
                        <button onClick={() => setEditingSectionId(null)}
                          style={{ fontSize: 12, color: '#a7a9af', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name) }}
                          style={{ fontSize: 12, color: '#6b6f77', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Renombrar</button>
                        <button onClick={() => handleDeleteSection(section.id)}
                          style={{ fontSize: 12, color: '#c0492f', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>Eliminar</button>
                      </>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '12px 14px' }}>
                    {/* Items list */}
                    {section.items.map(item => {
                      const displayName = item.menu_item?.name ?? item.custom_name ?? '—'
                      const displayPrice = item.menu_item?.price
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fafafa', borderRadius: 9, marginBottom: 6, border: '1px solid #f0f0f1' }}>
                          {isMenuDelDia && (
                            <button
                              onClick={() => handleToggleItem(section.id, item.id, !item.is_active)}
                              style={{ width: 32, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: item.is_active ? 'var(--accent)' : '#d1d5db', position: 'relative', transition: 'background .15s' }}
                            >
                              <span style={{ position: 'absolute', top: 2, left: item.is_active ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s', display: 'block' }} />
                            </button>
                          )}
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: item.is_active ? '#1b1e24' : '#a7a9af' }}>{displayName}</span>
                          {!item.menu_item_id && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#a7a9af', background: '#f0f0f2', borderRadius: 5, padding: '2px 6px', letterSpacing: '0.2px' }}>LIBRE</span>
                          )}
                          {displayPrice != null && (
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#6b6f77' }}>{displayPrice.toFixed(2)} €</span>
                          )}
                          <button onClick={() => handleRemoveItem(section.id, item.id)} style={{ color: '#c0492f', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>✕</button>
                        </div>
                      )
                    })}

                    {/* Add item */}
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Nombre libre */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={customNames[section.id] ?? ''}
                          onChange={e => setCustomNames(prev => ({ ...prev, [section.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAddCustomItem(section)}
                          placeholder="Escribir plato libre (sin carta)..."
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                          onClick={() => handleAddCustomItem(section)}
                          disabled={addingItem[section.id] || !(customNames[section.id] ?? '').trim()}
                          style={{ height: 38, padding: '0 14px', border: 'none', borderRadius: 10, background: '#25282f', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !(customNames[section.id] ?? '').trim() ? 0.4 : 1 }}
                        >+ Libre</button>
                      </div>
                      {/* Buscar en carta */}
                      <input
                        value={itemSearches[section.id] ?? ''}
                        onChange={e => setItemSearches(prev => ({ ...prev, [section.id]: e.target.value }))}
                        placeholder="O buscar en la carta..."
                        style={{ ...inputStyle, width: '100%' }}
                      />
                      {(itemSearches[section.id] ?? '').length > 0 && available.length > 0 && (
                        <div style={{ border: '1px solid #e8e8ea', borderRadius: 10, overflow: 'hidden', maxHeight: 180, overflowY: 'auto' }}>
                          {available.slice(0, 20).map(m => (
                            <button
                              key={m.id}
                              disabled={addingItem[section.id]}
                              onClick={() => handleAddItem(section, m.id)}
                              style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: '#fff', border: 'none', borderBottom: '1px solid #f2f2f3', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#1b1e24' }}>{m.name}</span>
                              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#6b6f77' }}>{m.price.toFixed(2)} €</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {(itemSearches[section.id] ?? '').length > 0 && available.length === 0 && (
                        <div style={{ fontSize: 12, color: '#a7a9af', padding: '6px 4px' }}>Sin resultados o ya añadido</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
