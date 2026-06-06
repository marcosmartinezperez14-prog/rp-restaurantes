import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { logoutAction } from '@/app/actions/auth'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

const NAV_CARDS = [
  {
    href: '/tpv',
    icon: '🖥️',
    label: 'TPV',
    description: 'Mesas, comandas y cobros',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    iconBg: 'bg-blue-100',
    labelColor: 'text-blue-700',
    modulo: 'tpv',
  },
  {
    href: '/reservas',
    icon: '📅',
    label: 'Reservas',
    description: 'Gestión de reservas del día',
    color: 'bg-violet-50 border-violet-200 hover:bg-violet-100',
    iconBg: 'bg-violet-100',
    labelColor: 'text-violet-700',
    modulo: 'pedidos',
  },
  {
    href: '/productos',
    icon: '📦',
    label: 'Productos',
    description: 'Inventario, stock y carta',
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    iconBg: 'bg-emerald-100',
    labelColor: 'text-emerald-700',
    modulo: 'productos',
  },
  {
    href: '/dashboard/finanzas',
    icon: '💰',
    label: 'Finanzas',
    description: 'Ingresos, gastos y beneficio',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    iconBg: 'bg-orange-100',
    labelColor: 'text-orange-700',
    modulo: 'finanzas',
  },
  {
    href: '/cocina',
    icon: '🍳',
    label: 'Cocina',
    description: 'Platos pendientes y en preparación',
    color: 'bg-red-50 border-red-200 hover:bg-red-100',
    iconBg: 'bg-red-100',
    labelColor: 'text-red-700',
    modulo: 'pedidos',
  },
  {
    href: '/dashboard/equipo',
    icon: '👥',
    label: 'Equipo',
    description: 'Usuarios, roles y permisos',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    iconBg: 'bg-purple-100',
    labelColor: 'text-purple-700',
    modulo: 'equipo',
  },
  {
    href: '/dashboard/configuracion',
    icon: '⚙️',
    label: 'Configuración',
    description: 'Apariencia y preferencias',
    color: 'bg-slate-50 border-slate-200 hover:bg-slate-100',
    iconBg: 'bg-slate-100',
    labelColor: 'text-slate-700',
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
      <div className="max-w-lg mx-auto">
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Bienvenido, <span className="font-medium text-[var(--text-primary)]">{nombreMostrado}</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {cardsVisibles.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={`flex flex-col items-center gap-3 p-6 rounded-2xl border transition-colors ${card.color}`}
            >
              <div className={`w-14 h-14 rounded-2xl ${card.iconBg} flex items-center justify-center text-3xl`}>
                {card.icon}
              </div>
              <div className="text-center">
                <div className={`text-base font-bold ${card.labelColor}`}>{card.label}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{card.description}</div>
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
      </div>
    </AppShell>
  )
}
