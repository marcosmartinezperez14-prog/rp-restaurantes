export interface ModuloSistema {
  key: string
  label: string
  ruta: string
  descripcion: string
  icono: string
  protegible: boolean
}

export const MODULOS_SISTEMA: ModuloSistema[] = [
  { key: 'tpv',      label: 'TPV',        ruta: '/tpv',                  descripcion: 'Terminal punto de venta y gestión de mesas',  icono: '🖥️',  protegible: true },
  { key: 'carta',    label: 'Carta',       ruta: '/productos',            descripcion: 'Inventario, stock y gestión de carta',         icono: '📦',  protegible: true },
  { key: 'cocina',   label: 'Cocina',      ruta: '/cocina',               descripcion: 'Platos pendientes y en preparación',           icono: '🍳',  protegible: true },
  { key: 'reservas', label: 'Reservas',    ruta: '/reservas',             descripcion: 'Gestión de reservas del día',                 icono: '📅',  protegible: true },
  { key: 'finanzas', label: 'Finanzas',    ruta: '/dashboard/finanzas',   descripcion: 'Ingresos, gastos y beneficio',                icono: '💰',  protegible: true },
  { key: 'informes', label: 'Informes',    ruta: '/dashboard/informes',   descripcion: 'Ventas, productos y franjas horarias',         icono: '📊',  protegible: true },
  { key: 'equipo',   label: 'Equipo',      ruta: '/dashboard/equipo',     descripcion: 'Usuarios, roles y permisos',                  icono: '👥',  protegible: true },
  { key: 'personal', label: 'Personal',    ruta: '/dashboard/personal',   descripcion: 'Turnos, vacaciones y días libres',            icono: '🗓️',  protegible: true },
  { key: 'negocio',  label: 'Mi negocio',  ruta: '/dashboard/negocio',    descripcion: 'KPIs del día en un vistazo',                  icono: '🏪',  protegible: true },
  { key: 'caja',     label: 'Caja',        ruta: '/dashboard/caja',       descripcion: 'Turnos, apertura y cierre de caja',           icono: '🏦',  protegible: true },
  { key: 'fichaje',  label: 'Fichaje',     ruta: '/dashboard/fichaje',    descripcion: 'Registro de entrada y salida de jornada',     icono: '⏱️',  protegible: false },
  { key: 'permisos', label: 'Permisos',    ruta: '/dashboard/permisos',   descripcion: 'Configuración de acceso por rol',             icono: '🔐',  protegible: true },
]

export const MODULOS_SIEMPRE_ACTIVOS = ['fichaje']
export const ROLES_PROTEGIDOS = ['admin']
export const SOLO_ADMIN_PUEDE_CONFIGURAR = ['gerente']
// Roles que nunca aparecen en la UI de permisos
export const ROLES_OCULTOS = ['superadmin']
// Roles que no se pueden eliminar aunque no sean admin
export const ROLES_NO_ELIMINABLES = ['admin', 'gerente']
