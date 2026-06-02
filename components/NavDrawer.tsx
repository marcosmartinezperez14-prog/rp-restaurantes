'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio',   icon: '🏠' },
  { href: '/tpv',       label: 'TPV',       icon: '🖥️' },
  { href: '/reservas',  label: 'Reservas',  icon: '📅' },
  { href: '/productos', label: 'Productos', icon: '📦' },
]

export default function NavDrawer() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

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
          <aside className="fixed left-0 top-0 h-full w-52 bg-white z-50 flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#64748b] uppercase tracking-widest">RP Restaurantes</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="text-[#94a3b8] hover:text-[#64748b] text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
              {NAV_ITEMS.map(item => {
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
                        : 'text-[#64748b] hover:bg-slate-100 hover:text-[#0f172a]'
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="px-3 py-3 border-t border-[#e2e8f0]">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  🚪 Cerrar sesión
                </button>
              </form>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
