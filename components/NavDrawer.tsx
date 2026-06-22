'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'
import { getFailed } from '@/lib/offline/db'
import FailedOperations from '@/components/offline/FailedOperations'
import { usePermisos } from '@/lib/permisos/usePermisos'
import { MODULOS_SIEMPRE_ACTIVOS } from '@/lib/permisos/modulos'

type NavItem = {
  href: string
  label: string
  icon: string
  moduloKey?: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',          label: 'Inicio',     icon: '🏠' },
  { href: '/dashboard/negocio',  label: 'Mi negocio', icon: '🏪', moduloKey: 'negocio' },
  { href: '/tpv',                label: 'TPV',         icon: '🖥️', moduloKey: 'tpv' },
  { href: '/reservas',           label: 'Reservas',    icon: '📅', moduloKey: 'reservas' },
  { href: '/productos',          label: 'Carta',       icon: '📦', moduloKey: 'carta' },
  { href: '/dashboard/informes', label: 'Informes',    icon: '📊', moduloKey: 'informes' },
  { href: '/dashboard/personal', label: 'Personal',    icon: '🗓️', moduloKey: 'personal' },
  { href: '/dashboard/fichaje',  label: 'Fichaje',     icon: '⏱️', moduloKey: 'fichaje' },
  { href: '/dashboard/caja',     label: 'Caja',        icon: '🏦', moduloKey: 'caja' },
]

export default function NavDrawer() {
  const [open, setOpen] = useState(false)
  const [failedCount, setFailedCount] = useState(0)
  const [showFailed, setShowFailed] = useState(false)
  const pathname = usePathname()
  const { tieneAcceso, rol, loading } = usePermisos()

  useEffect(() => {
    getFailed().then(ops => setFailedCount(ops.length)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    getFailed().then(ops => setFailedCount(ops.length)).catch(() => {})
  }, [open])

  const itemsVisibles = NAV_ITEMS.filter(item => {
    if (!item.moduloKey) return true
    if (MODULOS_SIEMPRE_ACTIVOS.includes(item.moduloKey)) return true
    return tieneAcceso(item.moduloKey)
  })

  const esAdminOGerente = loading || rol === 'admin' || rol === 'gerente'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="flex flex-col justify-center gap-[5px] w-8 h-8 rounded-lg hover:bg-slate-100 items-center flex-shrink-0"
      >
        <span className="block w-5 h-[2px] bg-[#64748b] rounded-full" />
        <span className="block w-5 h-[2px] bg-[#64748b] rounded-full" />
        <span className="block w-5 h-[2px] bg-[#64748b] rounded-full" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-52 bg-[var(--bg-surface)] z-50 flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">RP Restaurantes</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
              {itemsVisibles.map(item => {
                const active = item.href === '/dashboard'
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="px-3 py-3 border-t border-[var(--border)] flex flex-col gap-1">
              {failedCount > 0 && (
                <button
                  onClick={() => setShowFailed(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  ⚠️ {failedCount} op. fallidas
                </button>
              )}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  🚪 Cerrar sesión
                </button>
              </form>
            </div>
          </aside>
        </>
      )}
      {showFailed && (
        <FailedOperations
          onClose={() => {
            setShowFailed(false)
            getFailed().then(ops => setFailedCount(ops.length)).catch(() => {})
          }}
        />
      )}
    </>
  )
}
