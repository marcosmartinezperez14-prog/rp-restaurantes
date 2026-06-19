import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { logoutAction } from '@/app/actions/auth'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'

const ARROW_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M9 7h8v8"/>
  </svg>
)

const NAV_CARDS = [
  // ── Operación ──────────────────────────────────────────────
  {
    href: '/tpv',
    label: 'TPV',
    description: 'Mesas, comandas y cobros',
    section: 'operacion',
    modulo: 'tpv',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M6 7h7M6 11h4"/></svg>,
  },
  {
    href: '/dashboard/mesas',
    label: 'Mesas y QR',
    description: 'Plano de sala y carta digital',
    section: 'operacion',
    modulo: 'administracion',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 17.5V21"/></svg>,
  },
  {
    href: '/cocina',
    label: 'Cocina',
    description: 'Platos pendientes y en preparación',
    section: 'operacion',
    modulo: 'pedidos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 14h12v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"/><path d="M6 14a4 4 0 0 1-1-7.8A4 4 0 0 1 12 4.6 4 4 0 0 1 19 6.2 4 4 0 0 1 18 14"/></svg>,
  },
  {
    href: '/reservas',
    label: 'Reservas',
    description: 'Gestión de reservas del día',
    section: 'operacion',
    modulo: 'pedidos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/></svg>,
  },
  {
    href: '/dashboard/caja',
    label: 'Caja',
    description: 'Turnos, apertura y cierre de caja',
    section: 'operacion',
    modulo: 'administracion',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M15 15h3"/></svg>,
  },
  {
    href: '/dashboard/fichaje',
    label: 'Fichaje',
    description: 'Registra tu jornada laboral',
    section: 'operacion',
    modulo: 'personal',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  },
  // ── Gestión ────────────────────────────────────────────────
  {
    href: '/dashboard/negocio',
    label: 'Mi negocio',
    description: 'KPIs del día en un vistazo',
    section: 'gestion',
    modulo: 'administracion',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.4-5h15.2L21 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/></svg>,
  },
  {
    href: '/productos',
    label: 'Productos',
    description: 'Inventario, stock y carta',
    section: 'gestion',
    modulo: 'productos',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/></svg>,
  },
  {
    href: '/dashboard/finanzas',
    label: 'Finanzas',
    description: 'Ingresos, gastos y beneficio',
    section: 'gestion',
    modulo: 'finanzas',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/></svg>,
  },
  {
    href: '/dashboard/informes',
    label: 'Informes',
    description: 'Ventas, productos y franjas horarias',
    section: 'gestion',
    modulo: 'administracion',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx="0.5"/><rect x="10.5" y="6" width="3" height="12" rx="0.5"/><rect x="16" y="9" width="3" height="9" rx="0.5"/></svg>,
  },
  {
    href: '/dashboard/personal',
    label: 'Personal',
    description: 'Turnos, vacaciones y días libres',
    section: 'gestion',
    modulo: 'personal',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18M8.5 14.5l2 2 4-4"/></svg>,
  },
  {
    href: '/dashboard/equipo',
    label: 'Equipo',
    description: 'Usuarios, roles y permisos',
    section: 'gestion',
    modulo: 'equipo',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="9" cy="8" r="3.5"/><path d="M16 4.2a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-3.6-5.5"/></svg>,
  },
  {
    href: '/dashboard/permisos',
    label: 'Permisos',
    description: 'Accesos y roles de usuario',
    section: 'gestion',
    modulo: 'administracion',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>,
  },
  {
    href: '/dashboard/administracion',
    label: 'Administración',
    description: 'Datos fiscales y facturación',
    section: 'gestion',
    modulo: 'administracion',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="20" cy="14" r="2"/></svg>,
  },
  {
    href: '/dashboard/configuracion',
    label: 'Configuración',
    description: 'Apariencia y preferencias',
    section: 'gestion',
    modulo: 'configuracion',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.5 14.3a1.5 1.5 0 0 0 .3 1.6l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-2.5 1V20a2 2 0 0 1-4 0v-.2a1.5 1.5 0 0 0-2.5-1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.6 1.5 1.5 0 0 0-1.4-.9H4a2 2 0 0 1 0-4h.2a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.5 1.5 0 0 0 1.6.3H10a1.5 1.5 0 0 0 1-1.4V4a2 2 0 0 1 4 0v.2a1.5 1.5 0 0 0 1 1.4 1.5 1.5 0 0 0 1.6-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.6V10a1.5 1.5 0 0 0 1.4 1H22a2 2 0 0 1 0 4h-.2a1.5 1.5 0 0 0-1.4.9z"/></svg>,
  },
]

function SectionDivider({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: 'var(--text-label)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--border-strong)' }}>
        {String(count).padStart(2, '0')}
      </span>
    </div>
  )
}

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
  const rolRaw = roles?.[0]?.roles?.name ?? null
  const rol = (rolRaw && rolRaw in PERMISOS_POR_ROL ? rolRaw : null) as RolNombre | null
  const modulosPermitidos = rol ? PERMISOS_POR_ROL[rol].modulos : []

  const cardsVisibles = rol
    ? NAV_CARDS.filter(c => modulosPermitidos.includes(c.modulo) || c.modulo === 'configuracion')
    : NAV_CARDS

  const nombreMostrado = usuarioActual?.nombre
    ?? user.user_metadata?.username
    ?? user.email?.replace('@rp-internal.com', '')
    ?? ''

  const operacion = cardsVisibles.filter(c => c.section === 'operacion')
  const gestion = cardsVisibles.filter(c => c.section === 'gestion')

  const cardBase: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', textDecoration: 'none',
    color: 'inherit', background: 'var(--bg-surface)',
    border: '1px solid var(--border)', borderRadius: 15,
    padding: 20, minHeight: 148, transition: 'border-color .18s, box-shadow .18s, transform .18s',
  }

  return (
    <AppShell title="Inicio">
      {/* Saludo */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text-primary)' }}>
          Bienvenido, {nombreMostrado || 'usuario'}
        </h1>
        <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          Selecciona un módulo para empezar
        </p>
      </div>

      {/* Sección: Operación */}
      {operacion.length > 0 && (
        <>
          <SectionDivider label="Operación" count={operacion.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 32 }}>
            {operacion.map(card => (
              <Link key={card.href} href={card.href} style={cardBase}
                className="module-card"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--bg-icon)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {card.icon}
                  </div>
                  {ARROW_ICON}
                </div>
                <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.2px', marginTop: 16, color: 'var(--text-primary)' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 4 }}>
                  {card.description}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Sección: Gestión */}
      {gestion.length > 0 && (
        <>
          <SectionDivider label="Gestión" count={gestion.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 32 }}>
            {gestion.map(card => (
              <Link key={card.href} href={card.href} style={{ ...cardBase, minHeight: 120 }}
                className="module-card"
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--bg-icon)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {card.icon}
                  </div>
                  {ARROW_ICON}
                </div>
                <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.2px', marginTop: 14, color: 'var(--text-primary)' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 4 }}>
                  {card.description}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Cerrar sesión */}
      <form action={logoutAction}>
        <button
          type="submit"
          style={{
            width: '100%', padding: '10px', fontSize: 13,
            color: 'var(--text-secondary)', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 10,
            cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
          }}
          className="logout-btn"
        >
          Cerrar sesión
        </button>
      </form>

      <style>{`
        .module-card:hover {
          border-color: var(--accent) !important;
          box-shadow: 0 8px 22px color-mix(in srgb, var(--accent) 12%, transparent) !important;
          transform: translateY(-2px) !important;
        }
        .logout-btn:hover {
          background: color-mix(in srgb, var(--status-red) 6%, transparent) !important;
          color: var(--status-red) !important;
          border-color: color-mix(in srgb, var(--status-red) 30%, transparent) !important;
        }
      `}</style>
    </AppShell>
  )
}
