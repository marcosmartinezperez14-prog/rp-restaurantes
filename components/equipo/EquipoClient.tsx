'use client'

import { useState, useEffect } from 'react'
import { RolNombre, UsuarioEquipo, PERMISOS_POR_ROL } from '@/types/equipo'
import { ROLES_PROTEGIDOS, ROLES_OCULTOS } from '@/lib/permisos/modulos'
import type { MatrizPermisos } from '@/types/permisos'
import ConfiguracionPermisos from '@/components/permisos/ConfiguracionPermisos'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

const COLOR_ROL: Record<RolNombre, { bg: string; text: string; badge: string; avatar: string }> = {
  admin:    { bg: 'bg-purple-50',  text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700',  avatar: 'bg-purple-200 text-purple-800' },
  gerente:  { bg: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',      avatar: 'bg-blue-200 text-blue-800'    },
  camarero: { bg: 'bg-green-50',   text: 'text-green-700',   badge: 'bg-green-100 text-green-700',    avatar: 'bg-green-200 text-green-800'  },
  cocinero: { bg: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',  avatar: 'bg-orange-200 text-orange-800'},
  contable: { bg: 'bg-yellow-50',  text: 'text-yellow-700',  badge: 'bg-yellow-100 text-yellow-700',  avatar: 'bg-yellow-200 text-yellow-800'},
}

const MODULOS_LABELS: Record<string, string> = {
  dashboard:     'Dashboard',
  tpv:           'TPV',
  pedidos:       'Pedidos',
  productos:     'Productos',
  finanzas:      'Finanzas',
  facturas:      'Facturas',
  equipo:        'Equipo',
  configuracion: 'Configuración',
}

const FALLBACK_COLOR = { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700', avatar: 'bg-gray-200 text-gray-800' }

function getColorRol(rol: string) {
  return COLOR_ROL[rol as RolNombre] ?? FALLBACK_COLOR
}

function getRolLabel(rol: string): string {
  return PERMISOS_POR_ROL[rol as RolNombre]?.label ?? (rol.charAt(0).toUpperCase() + rol.slice(1))
}

function getRolDescripcion(rol: string): string {
  return PERMISOS_POR_ROL[rol as RolNombre]?.descripcion ?? ''
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  mensaje: string
  tipo: 'exito' | 'error'
}

// ─── Modal Añadir Usuario ─────────────────────────────────────────────────────

interface ModalAnadirUsuarioProps {
  rolesDisponibles: Array<{role_id: string, role_name: string}>
  onClose: () => void
  onCreado: (usuario: UsuarioEquipo) => void
  onToast: (mensaje: string, tipo: 'exito' | 'error') => void
}

function ModalAnadirUsuario({ rolesDisponibles, onClose, onCreado, onToast }: ModalAnadirUsuarioProps) {
  const [nombre, setNombre] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rolSeleccionado, setRolSeleccionado] = useState<string>('camarero')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!username.trim()) { setError('El usuario es obligatorio'); return }
    if (!/^[a-z0-9_-]+$/i.test(username.trim())) { setError('El usuario solo puede contener letras, números, guiones y guiones bajos'); return }
    if (!password.trim()) { setError('La contraseña es obligatoria'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setGuardando(true)
    try {
      const res = await fetch('/api/equipo/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), nombre: nombre.trim(), password, role_name: rolSeleccionado }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? 'Error al crear el usuario')
        return
      }
      const nuevoUsuario: UsuarioEquipo = {
        id: data.usuario.id,
        auth_id: data.usuario.auth_id,
        nombre: nombre.trim(),
        email: `${username.trim().toLowerCase()}@rp-internal.com`,
        avatar_url: null,
        activo: true,
        created_at: new Date().toISOString(),
        rol: rolSeleccionado,
        user_role_id: data.usuario.user_role_id ?? '',
      }
      onCreado(nuevoUsuario)
      onClose()
      onToast('Usuario creado correctamente. Ya puede acceder con sus credenciales.', 'exito')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Añadir usuario</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: María García"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: maria_garcia"
              autoComplete="off"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Contraseña temporal</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Rol</label>
            <select
              value={rolSeleccionado}
              onChange={(e) => setRolSeleccionado(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            >
              {rolesDisponibles.length === 0 && (
                <option value="" disabled>Cargando roles...</option>
              )}
              {rolesDisponibles.map((r) => (
                <option key={r.role_id} value={r.role_name}>
                  {getRolLabel(r.role_name)}{getRolDescripcion(r.role_name) ? ` — ${getRolDescripcion(r.role_name)}` : ''}
                </option>
              ))}
            </select>

            {PERMISOS_POR_ROL[rolSeleccionado as RolNombre] && (
              <div className={`mt-2 rounded-lg p-3 ${getColorRol(rolSeleccionado).bg}`}>
                <p className={`text-xs font-medium mb-2 ${getColorRol(rolSeleccionado).text}`}>
                  Módulos con acceso:
                </p>
                <div className="flex flex-wrap gap-1">
                  {PERMISOS_POR_ROL[rolSeleccionado as RolNombre].modulos.map((m) => (
                    <span key={m} className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {MODULOS_LABELS[m] ?? m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Cambiar Rol ────────────────────────────────────────────────────────

interface ModalCambiarRolProps {
  usuario: UsuarioEquipo
  rolesDisponibles: Array<{role_id: string, role_name: string}>
  onClose: () => void
  onCambiado: (usuarioId: string, nuevoRol: string) => void
  onToast: (mensaje: string, tipo: 'exito' | 'error') => void
}

function ModalCambiarRol({ usuario, rolesDisponibles, onClose, onCambiado, onToast }: ModalCambiarRolProps) {
  const [rolSeleccionado, setRolSeleccionado] = useState<string>(usuario.rol)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    if (rolSeleccionado === usuario.rol) {
      onClose()
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const res = await fetch('/api/equipo/cambiar-rol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_role_id: usuario.user_role_id, nuevo_rol: rolSeleccionado }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? 'Error al cambiar el rol')
        return
      }
      onCambiado(usuario.id, rolSeleccionado)
      onClose()
      onToast(`Rol de ${usuario.nombre} actualizado a ${getRolLabel(rolSeleccionado)}`, 'exito')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Cambiar rol</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Cambiando rol de <span className="font-medium text-[var(--text-primary)]">{usuario.nombre}</span>
          </p>

          <div>
            <select
              value={rolSeleccionado}
              onChange={(e) => setRolSeleccionado(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            >
              {rolesDisponibles.length === 0 && (
                <option value="" disabled>Cargando roles...</option>
              )}
              {rolesDisponibles.map((r) => (
                <option key={r.role_id} value={r.role_name}>
                  {getRolLabel(r.role_name)}
                </option>
              ))}
            </select>

            {PERMISOS_POR_ROL[rolSeleccionado as RolNombre] && (
              <div className={`mt-2 rounded-lg p-3 ${getColorRol(rolSeleccionado).bg}`}>
                <p className={`text-xs font-medium ${getColorRol(rolSeleccionado).text}`}>
                  {getRolDescripcion(rolSeleccionado) || getRolLabel(rolSeleccionado)}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {PERMISOS_POR_ROL[rolSeleccionado as RolNombre].modulos.map((m) => (
                    <span key={m} className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {MODULOS_LABELS[m] ?? m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando...' : 'Guardar cambio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  usuarios: UsuarioEquipo[]
  rolActual: RolNombre
  usuarioActualId: string
  restaurantId: string
  rolUsuarioActual: 'admin' | 'gerente' | null
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EquipoClient({ usuarios: usuariosIniciales, rolActual, usuarioActualId, rolUsuarioActual }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioEquipo[]>(usuariosIniciales)
  const [mostrarModalAnadir, setMostrarModalAnadir] = useState(false)
  const [usuarioCambioRol, setUsuarioCambioRol] = useState<UsuarioEquipo | null>(null)
  const [usuarioCambioPassword, setUsuarioCambioPassword] = useState<UsuarioEquipo | null>(null)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [cargando, setCargando] = useState(false)
  const [rolesDisponibles, setRolesDisponibles] = useState<Array<{role_id: string, role_name: string}>>([])
  const [tabActiva, setTabActiva] = useState<'equipo' | 'permisos'>('equipo')

  useEffect(() => {
    fetch('/api/permisos/rol')
      .then(r => r.json())
      .then(data => {
        const lista = ((data?.data ?? []) as MatrizPermisos[])
          .filter(r => !ROLES_PROTEGIDOS.includes(r.role_name) && !ROLES_OCULTOS.includes(r.role_name))
          .map(r => ({ role_id: r.role_id, role_name: r.role_name }))
        setRolesDisponibles(lista)
      })
      .catch(() => {/* silencioso: los modales muestran lista vacía o fallback */})
  }, [])

  const esAdmin = rolActual === 'admin'
  const puedeGestionar = rolActual === 'admin' || rolActual === 'gerente'

  function mostrarToast(mensaje: string, tipo: 'exito' | 'error') {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 4000)
  }

  // ─── Desactivar ───────────────────────────────────────────────────────────

  async function handleDesactivar(usuario: UsuarioEquipo) {
    if (!confirm(`¿Desactivar a ${usuario.nombre}? No podrá acceder al sistema.`)) return
    setCargando(true)
    try {
      const res = await fetch('/api/equipo/desactivar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: usuario.id }),
      })
      const data = await res.json()
      if (!data.success) {
        mostrarToast(data.error ?? 'Error al desactivar el usuario', 'error')
        return
      }
      setUsuarios((prev) => prev.map((u) => u.id === usuario.id ? { ...u, activo: false } : u))
      mostrarToast(`${usuario.nombre} ha sido desactivado`, 'exito')
    } catch {
      mostrarToast('Error de conexión. Inténtalo de nuevo.', 'error')
    } finally {
      setCargando(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {/* Tabs */}
      {puedeGestionar && (
        <div className="flex gap-1 border-b border-[var(--border)] mb-6">
          <button
            onClick={() => setTabActiva('equipo')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tabActiva === 'equipo'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Equipo
          </button>
          <button
            onClick={() => setTabActiva('permisos')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tabActiva === 'permisos'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Permisos
          </button>
        </div>
      )}

      {tabActiva === 'equipo' && (
        <>
          {/* Cabecera */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Equipo</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">{usuarios.length} {usuarios.length === 1 ? 'miembro' : 'miembros'}</p>
            </div>
            {puedeGestionar && (
              <button
                onClick={() => setMostrarModalAnadir(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--primary-hover)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Añadir usuario
              </button>
            )}
          </div>

          {/* Grid de tarjetas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {usuarios.map((usuario) => {
              const colores = getColorRol(usuario.rol)
              const esYo = usuario.id === usuarioActualId
              const puedeActuar = esAdmin && !esYo

              return (
                <div
                  key={usuario.id}
                  className={`relative bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-3 ${!usuario.activo ? 'opacity-60' : ''}`}
                >
                  {/* Badge "Tú" */}
                  {esYo && (
                    <span className="absolute top-4 right-4 text-xs font-semibold bg-[var(--primary)] text-white rounded-full px-2 py-0.5">
                      Tú
                    </span>
                  )}

                  {/* Menú de acciones */}
                  {puedeActuar && (
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={() => setMenuAbierto(menuAbierto === usuario.id ? null : usuario.id)}
                        className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                      {menuAbierto === usuario.id && (
                        <div className="absolute right-0 top-8 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-lg py-1 w-48 z-10">
                          <button
                            onClick={() => { setUsuarioCambioRol(usuario); setMenuAbierto(null) }}
                            className="w-full text-left px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                          >
                            Cambiar rol
                          </button>
                          <button
                            onClick={() => { setUsuarioCambioPassword(usuario); setMenuAbierto(null) }}
                            className="w-full text-left px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                          >
                            Cambiar contraseña
                          </button>
                          {usuario.activo && (
                            <button
                              onClick={() => { handleDesactivar(usuario); setMenuAbierto(null) }}
                              disabled={cargando}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              Desactivar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Avatar + Nombre */}
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${colores.avatar}`}>
                      {iniciales(usuario.nombre)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{usuario.nombre}</p>
                      <p className="text-xs text-[var(--text-secondary)] truncate">@{usuario.email.replace('@rp-internal.com', '')}</p>
                    </div>
                  </div>

                  {/* Badge de rol */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colores.badge}`}>
                      {getRolLabel(usuario.rol)}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${usuario.activo ? 'bg-green-400' : 'bg-[var(--text-secondary)]'}`} />
                      <span className={usuario.activo ? 'text-green-600' : 'text-[var(--text-secondary)]'}>
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </span>
                  </div>

                  {/* Descripción del rol */}
                  {getRolDescripcion(usuario.rol) && (
                    <p className="text-xs text-[var(--text-secondary)]">{getRolDescripcion(usuario.rol)}</p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {tabActiva === 'permisos' && puedeGestionar && rolUsuarioActual && (
        <ConfiguracionPermisos rolUsuarioActual={rolUsuarioActual} />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
            toast.tipo === 'exito' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.mensaje}
        </div>
      )}

      {/* Modales */}
      {mostrarModalAnadir && (
        <ModalAnadirUsuario
          rolesDisponibles={rolesDisponibles}
          onClose={() => setMostrarModalAnadir(false)}
          onCreado={(nuevoUsuario) => setUsuarios(prev => [...prev, nuevoUsuario])}
          onToast={mostrarToast}
        />
      )}
      {usuarioCambioRol && (
        <ModalCambiarRol
          usuario={usuarioCambioRol}
          rolesDisponibles={rolesDisponibles}
          onClose={() => setUsuarioCambioRol(null)}
          onCambiado={(usuarioId, nuevoRol) => setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, rol: nuevoRol } : u))}
          onToast={mostrarToast}
        />
      )}
      {usuarioCambioPassword && (
        <ModalCambiarPasswordAdmin
          usuario={usuarioCambioPassword}
          onClose={() => setUsuarioCambioPassword(null)}
          onExito={() => {
            setUsuarioCambioPassword(null)
            mostrarToast(`Contraseña de ${usuarioCambioPassword.nombre} actualizada`, 'exito')
          }}
        />
      )}

      {/* Overlay para cerrar menú */}
      {menuAbierto && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuAbierto(null)} />
      )}
    </div>
  )
}

// ─── Modal cambiar contraseña (admin) ─────────────────────────────────────────

function ModalCambiarPasswordAdmin({
  usuario,
  onClose,
  onExito,
}: {
  usuario: UsuarioEquipo
  onClose: () => void
  onExito: () => void
}) {
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setError(null)
    if (nueva.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden'); return }

    setGuardando(true)
    try {
      const res = await fetch('/api/equipo/cambiar-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_id: usuario.auth_id, nueva_password: nueva }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error ?? 'Error al cambiar la contraseña'); return }
      onExito()
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Cambiar contraseña</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{usuario.nombre}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={nueva}
              onChange={e => setNueva(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              placeholder="Repite la contraseña"
              onKeyDown={e => e.key === 'Enter' && handleGuardar()}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
