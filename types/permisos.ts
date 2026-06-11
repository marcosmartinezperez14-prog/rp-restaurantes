export interface PermisoRol {
  id: string
  restaurant_id: string
  role_id: string
  modulo_key: string
  activo: boolean
  updated_at: string
  updated_by: string | null
}

export interface PermisosUsuario {
  [modulo_key: string]: boolean
}

export interface MatrizPermisos {
  role_id: string
  role_name: string
  permisos: {
    [modulo_key: string]: boolean
  }
}

export interface RespuestaMios {
  rol: string | null
  permisos: PermisosUsuario
}
