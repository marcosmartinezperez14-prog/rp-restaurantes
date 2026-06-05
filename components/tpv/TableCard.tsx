'use client'

import type { TableWithOrder, TableStatus } from '@/app/actions/tpv'

const STATUS_CONFIG: Record<TableStatus, { label: string; bg: string; text: string; border: string }> = {
  free:     { label: 'Libre',     bg: '#bbf7d0', text: '#15803d', border: '#22c55e' },
  occupied: { label: 'Ocupada',   bg: '#fca5a5', text: '#b91c1c', border: '#ef4444' },
  reserved: { label: 'Reservada', bg: '#fde68a', text: '#92400e', border: '#eab308' },
  billing:  { label: 'Cobrando',  bg: '#93c5fd', text: '#1d4ed8', border: '#3b82f6' },
}

function formatElapsed(openedAt: string): string {
  const diff = Date.now() - new Date(openedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}min`
}

export default function TableCard({
  table,
  onClick,
  disabled,
  isEditing,
  onDelete,
}: {
  table: TableWithOrder
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  isEditing?: boolean
  onDelete?: () => void
}) {
  const cfg = STATUS_CONFIG[table.status]
  const showExtra = (table.status === 'occupied' || table.status === 'billing') && table.openOrder
  const canDelete = isEditing && table.status === 'free'

  return (
    <div className="relative">
      <button
        onClick={isEditing ? undefined : onClick}
        disabled={disabled || isEditing}
        style={{
          borderColor: cfg.border,
          borderWidth: '1.5px',
          borderStyle: 'solid',
          borderRadius: '10px',
          minWidth: '100px',
          minHeight: '90px',
        }}
        className="bg-white p-3 flex flex-col gap-1 text-left hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed w-full"
      >
        <span className="font-bold text-[#0f172a] text-sm leading-tight">{table.name}</span>
        <span className="text-[#64748b] text-xs">{table.capacity} pers.</span>
        <span
          style={{ background: cfg.bg, color: cfg.text, borderRadius: '4px' }}
          className="text-[10px] font-semibold uppercase px-1.5 py-0.5 mt-auto self-start"
        >
          {cfg.label}
        </span>
        {showExtra && (
          <div className="text-[10px] text-[#64748b] mt-0.5">
            <div>{formatElapsed(table.openOrder!.opened_at)}</div>
            <div className="font-semibold text-[#0f172a]">{Number(table.openOrder!.total).toFixed(2)} €</div>
          </div>
        )}
      </button>

      {isEditing && (
        <button
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? 'Eliminar mesa' : 'Cierra la comanda primero'}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-500 text-white hover:bg-red-600"
        >
          ✕
        </button>
      )}
    </div>
  )
}
