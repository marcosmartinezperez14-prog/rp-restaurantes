'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Inicio',    icon: '🏠' },
  { href: '/tpv',        label: 'TPV',        icon: '🖥️' },
  { href: '/reservas',   label: 'Reservas',   icon: '📅' },
  { href: '/productos',  label: 'Productos',  icon: '📦' },
]

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-[#e2e8f0] flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-[#e2e8f0]">
          <span className="text-[13px] font-bold text-[#64748b] uppercase tracking-widest">RP Restaurantes</span>
        </div>
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href) && item.href !== '/dashboard'
              ? true
              : pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-[#64748b] hover:bg-slate-100 hover:text-[#0f172a]'
                }`}
              >
                <span>{item.icon}</span>
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-[#e2e8f0] px-6 h-[52px] flex items-center flex-shrink-0 shadow-sm">
          <h1 className="text-[15px] font-semibold text-[#0f172a]">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
