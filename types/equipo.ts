export type RolNombre = 'admin' | 'gerente' | 'camarero' | 'cocinero' | 'contable'

export interface UsuarioEquipo {
  id: string
  auth_id: string
  nombre: string
  email: string
  avatar_url: string | null
  activo: boolean
  created_at: string
  rol: RolNombre
  user_role_id: string
}

export const ROLES_EDITORES: RolNombre[] = ['admin', 'gerente']

export const PERMISOS_POR_ROL: Record<RolNombre, {
  label: string
  color: string
  descripcion: string
  modulos: string[]
}> = {
  admin: {
    label: 'Administrador',
    color: 'purple',
    descripcion: 'Acceso total al sistema',
    modulos: ['dashboard', 'tpv', 'pedidos', 'productos', 'finanzas', 'facturas', 'equipo', 'personal', 'configuracion', 'administracion'],
  },
  gerente: {
    label: 'Gerente',
    color: 'blue',
    descripcion: 'Todo menos configuración crítica',
    modulos: ['dashboard', 'tpv', 'pedidos', 'productos', 'finanzas', 'facturas', 'equipo', 'personal', 'administracion'],
  },
  camarero: {
    label: 'Camarero',
    color: 'green',
    descripcion: 'Solo TPV y pedidos',
    modulos: ['tpv', 'pedidos', 'personal'],
  },
  cocinero: {
    label: 'Cocinero',
    color: 'orange',
    descripcion: 'Solo visualización de pedidos',
    modulos: ['pedidos', 'personal'],
  },
  contable: {
    label: 'Contable',
    color: 'yellow',
    descripcion: 'Solo finanzas y facturas',
    modulos: ['finanzas', 'facturas', 'personal'],
  },
}
