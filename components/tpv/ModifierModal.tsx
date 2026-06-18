'use client'

import { useState } from 'react'
import type { ProductWithModifiers, SelectedModifier } from '@/app/actions/tpv'

interface Props {
  product: ProductWithModifiers
  onConfirm: (modifiers: SelectedModifier[]) => void
  onClose: () => void
}

export default function ModifierModal({ product, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const g of product.modifierGroups) init[g.id] = []
    return init
  })

  const totalModifiers = product.modifierGroups
    .flatMap(g => g.options.filter(o => (selected[g.id] ?? []).includes(o.id)))
    .reduce((sum, o) => sum + o.price_delta, 0)

  const totalPrice = product.price + totalModifiers

  const allRequiredMet = product.modifierGroups
    .filter(g => g.required)
    .every(g => (selected[g.id] ?? []).length >= 1)

  function toggleOption(groupId: string, optionId: string, allowsMultiple: boolean) {
    setSelected(prev => {
      const current = prev[groupId] ?? []
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter(id => id !== optionId) }
      }
      if (!allowsMultiple) {
        return { ...prev, [groupId]: [optionId] }
      }
      return { ...prev, [groupId]: [...current, optionId] }
    })
  }

  function handleConfirm() {
    const modifiers: SelectedModifier[] = product.modifierGroups.flatMap(g =>
      g.options
        .filter(o => (selected[g.id] ?? []).includes(o.id))
        .map(o => ({ option_id: o.id, name: o.name, price_adjustment: o.price_delta }))
    )
    onConfirm(modifiers)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{product.name}</h2>
          <p className="text-sm text-[var(--text-secondary)]">Selecciona las opciones</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">
          {product.modifierGroups.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-semibold text-sm text-[var(--text-primary)]">{group.name}</span>
                {group.required ? (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                    Obligatorio
                  </span>
                ) : (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                    Opcional
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {group.options.map(option => {
                  const isChecked = (selected[group.id] ?? []).includes(option.id)
                  const isRadio = !group.allows_multiple
                  return (
                    <label
                      key={option.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] cursor-pointer hover:bg-[var(--bg-page)]"
                    >
                      <input
                        type={isRadio ? 'radio' : 'checkbox'}
                        name={isRadio ? group.id : undefined}
                        checked={isChecked}
                        onChange={() => toggleOption(group.id, option.id, group.allows_multiple)}
                        className="accent-[#2563eb]"
                      />
                      <span className="flex-1 text-sm text-[var(--text-primary)]">{option.name}</span>
                      <span className="text-sm text-[var(--text-secondary)]">
                        {option.price_delta > 0
                          ? `+${Number(option.price_delta).toFixed(2)} €`
                          : '—'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-[var(--border)] flex items-center justify-between gap-3">
          <span className="font-bold text-[var(--text-primary)]">
            {Number(totalPrice).toFixed(2)} €
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!allRequiredMet}
              style={{ minHeight: '44px', fontWeight: 700 }}
              className="px-4 py-2 text-sm bg-[#2563eb] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-hover)]"
            >
              Añadir a la comanda
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
