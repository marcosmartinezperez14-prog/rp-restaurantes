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
    href: '/dashboard/fichaje',
    icon: '⏱️',
    label: 'Fichaje',
    description: 'Registra tu jornada laboral',
    color: 'bg-[var(--bg-surface)] border-amber-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-amber-500/15',
    labelColor: 'text-amber-600',
    modulo: 'personal',
  },
  {
    href: '/dashboard/informes',
    icon: '📊',
    label: 'Informes',
    description: 'Ventas, productos y franjas horarias',
    color: 'bg-[var(--bg-surface)] border-cyan-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-cyan-500/15',
    labelColor: 'text-cyan-600',
    modulo: 'administracion',
  },
  {
    href: '/dashboard/negocio',
    icon: '🏪',
    label: 'Mi negocio',
    description: 'KPIs del día en un vistazo',
    color: 'bg-[var(--bg-surface)] border-indigo-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-indigo-500/15',
    labelColor: 'text-indigo-600',
    modulo: 'administracion',
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
  {
    href: '/dashboard/caja',
    icon: '🏦',
    label: 'Caja',
    description: 'Turnos, apertura y cierre de caja',
    color: 'bg-[var(--bg-surface)] border-green-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-green-500/15',
    labelColor: 'text-green-600',
    modulo: 'administracion',
  },
  {
    href: '/dashboard/administracion',
    icon: '🔧',
    label: 'Administración',
    description: 'Reservas, horarios y configuración avanzada',
    color: 'bg-[var(--bg-surface)] border-rose-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-rose-500/15',
    labelColor: 'text-rose-600',
    modulo: 'administracion',
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

  const roles = usuarioActual?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const modulosPermitidos = rol ? PERMISOS_POR_ROL[rol].modulos : []

  const cardsVisibles = rol
    ? NAV_CARDS.filter(c => modulosPermitidos.includes(c.modulo) || c.modulo === 'configuracion')
    : NAV_CARDS

  const nombreMostrado = usuarioActual?.nombre
    ?? user.user_metadata?.username
    ?? user.email?.replace('@rp-internal.com', '')
    ?? ''

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

      </div>
    </AppShell>
  )
}
