import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { logoutAction } from '@/app/actions/auth'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'
import ClearDataButton from './ClearDataButton'

const NAV_CARDS = [
  {
    href: '/tpv',
    icon: '🖥️',
    label: 'TPV',
    description: 'Mesas, comandas y cobros',
    color: 'bg-[var(--bg-surface)] border-blue-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-blue-500/15',
    labelColor: 'text-blue-600',
    modulo: 'tpv',
  },
  {
    href: '/reservas',
    icon: '📅',
    label: 'Reservas',
    description: 'Gestión de reservas del día',
    color: 'bg-[var(--bg-surface)] border-violet-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-violet-500/15',
    labelColor: 'text-violet-600',
    modulo: 'pedidos',
  },
  {
    href: '/productos',
    icon: '📦',
    label: 'Productos',
    description: 'Inventario, stock y carta',
    color: 'bg-[var(--bg-surface)] border-emerald-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-emerald-500/15',
    labelColor: 'text-emerald-600',
    modulo: 'productos',
  },
  {
    href: '/dashboard/finanzas',
    icon: '💰',
    label: 'Finanzas',
    description: 'Ingresos, gastos y beneficio',
    color: 'bg-[var(--bg-surface)] border-orange-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-orange-500/15',
    labelColor: 'text-orange-600',
    modulo: 'finanzas',
  },
  {
    href: '/cocina',
    icon: '🍳',
    label: 'Cocina',
    description: 'Platos pendientes y en preparación',
    color: 'bg-[var(--bg-surface)] border-red-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-red-500/15',
    labelColor: 'text-red-600',
    modulo: 'pedidos',
  },
  {
    href: '/dashboard/equipo',
    icon: '👥',
    label: 'Equipo',
    description: 'Usuarios, roles y permisos',
    color: 'bg-[var(--bg-surface)] border-purple-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-purple-500/15',
    labelColor: 'text-purple-600',
    modulo: 'equipo',
  },
  {
    href: '/dashboard/personal',
    icon: '🗓️',
    label: 'Personal',
    description: 'Turnos, vacaciones y días libres',
    color: 'bg-[var(--bg-surface)] border-teal-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-teal-500/15',
    labelColor: 'text-teal-600',
    modulo: 'personal',
  },
  {
    href: '/dashboard/configuracion',
    icon: '⚙️',
    label: 'Configuración',
    description: 'Apariencia y preferencias',
    color: 'bg-[var(--bg-surface)] border-slate-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-slate-500/15',
    labelColor: 'text-slate-600',
    modulo: 'configuracion',
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('users')
    .select('nombre, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = usuarioActual?.user_roles as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const modulosPermitidos = rol ? PERMISOS_POR_ROL[rol].modulos : []

  const cardsVisibles = rol
    ? NAV_CARDS.filter(c => modulosPermitidos.includes(c.modulo) || c.modulo === 'configuracion')
    : NAV_CARDS

  const nombreMostrado = usuarioActual?.nombre || user.email

  return (
    <AppShell title="Inicio">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Bienvenido, <span className="font-medium text-[var(--text-primary)]">{nombreMostrado}</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
          {cardsVisibles.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={`flex flex-col items-center gap-4 p-8 rounded-2xl border transition-colors ${card.color}`}
            >
              <div className={`w-16 h-16 rounded-2xl ${card.iconBg} flex items-center justify-center text-4xl`}>
                {card.icon}
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${card.labelColor}`}>{card.label}</div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">{card.description}</div>
              </div>
            </Link>
          ))}
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full py-2.5 text-sm text-[var(--text-secondary)] border border-[var(--border)] rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            Cerrar sesión
          </button>
        </form>

        {rol === 'admin' && (
          <div className="mt-8 border border-red-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-red-700 mb-1">Zona peligrosa</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Elimina todos los datos transaccionales del restaurante (pedidos, pagos, reservas, movimientos de stock, carta). Los usuarios, productos y configuración se conservan.
            </p>
            <ClearDataButton />
          </div>
        )}
      </div>
    </AppShell>
  )
}
