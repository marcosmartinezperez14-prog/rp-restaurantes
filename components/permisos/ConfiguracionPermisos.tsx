'use client'

import { useEffect, useState } from 'react'
import type { MatrizPermisos } from '@/types/permisos'
import { MODULOS_SISTEMA, MODULOS_SIEMPRE_ACTIVOS, ROLES_PROTEGIDOS, SOLO_ADMIN_PUEDE_CONFIGURAR } from '@/lib/permisos/modulos'
import { limpiarCachePermisos } from '@/lib/permisos/usePermisos'

interface Props {
  rolUsuarioActual: 'admin' | 'gerente'
}

const ORDEN_ROLES_SISTEMA = ['admin', 'gerente', 'camarero', 'cocinero', 'contable']

export default function ConfiguracionPermisos({ rolUsuarioActual }: Props) {
  const [matriz, setMatriz] = useState<MatrizPermisos[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [tabActivo, setTabActivo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)

  // Modal crear rol
  const [modalCrear, setModalCrear] = useState(false)
  const [nombreNuevoRol, setNombreNuevoRol] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)

  // Eliminar rol
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  useEffect(() => {
    cargarMatriz()
  }, [rolUsuarioActual])

  function cargarMatriz() {
    setCargando(true)
    fetch('/api/permisos/rol')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setErrorCarga(data.error); return }
        const ordenada = ordenarRoles(data.data as MatrizPermisos[])
        setMatriz(ordenada)
        const configurables = getRolesConfigurables(ordenada, rolUsuarioActual)
        if (configurables.length > 0 && !tabActivo) {
          setTabActivo(configurables[0].role_name)
        }
      })
      .catch(() => setErrorCarga('No se pudo cargar la configuración'))
      .finally(() => setCargando(false))
  }

  function ordenarRoles(m: MatrizPermisos[]): MatrizPermisos[] {
    return [...m].sort((a, b) => {
      const ia = ORDEN_ROLES_SISTEMA.indexOf(a.role_name)
      const ib = ORDEN_ROLES_SISTEMA.indexOf(b.role_name)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.role_name.localeCompare(b.role_name)
    })
  }

  function getRolesConfigurables(m: MatrizPermisos[], rolActual: 'admin' | 'gerente'): MatrizPermisos[] {
    return m.filter(r => {
      if (ROLES_PROTEGIDOS.includes(r.role_name)) return false
      if (rolActual === 'gerente' && SOLO_ADMIN_PUEDE_CONFIGURAR.includes(r.role_name)) return false
      return true
    })
  }

  async function handleToggle(roleId: string, moduloKey: string, nuevoActivo: boolean) {
    const guardandoKey = `${roleId}:${moduloKey}`
    setErrorGuardado(null)

    setMatriz(prev => prev.map(r =>
      r.role_id === roleId
        ? { ...r, permisos: { ...r.permisos, [moduloKey]: nuevoActivo } }
        : r
    ))
    setGuardando(prev => ({ ...prev, [guardandoKey]: true }))

    try {
      const res = await fetch('/api/permisos/rol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, modulo_key: moduloKey, activo: nuevoActivo }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMatriz(prev => prev.map(r =>
          r.role_id === roleId
            ? { ...r, permisos: { ...r.permisos, [moduloKey]: !nuevoActivo } }
            : r
        ))
        setErrorGuardado(data.error ?? 'Error al guardar')
        return
      }
      limpiarCachePermisos()
      setMensajeGuardado('Guardado')
      setTimeout(() => setMensajeGuardado(null), 2000)
    } catch {
      setMatriz(prev => prev.map(r =>
        r.role_id === roleId
          ? { ...r, permisos: { ...r.permisos, [moduloKey]: !nuevoActivo } }
          : r
      ))
      setErrorGuardado('Error de conexión')
    } finally {
      setGuardando(prev => ({ ...prev, [guardandoKey]: false }))
    }
  }

  async function handleCrearRol() {
    setErrorCrear(null)
    if (!nombreNuevoRol.trim()) { setErrorCrear('Escribe un nombre para el rol'); return }
    setCreando(true)
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreNuevoRol }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setErrorCrear(data.error ?? 'Error al crear'); return }
      setModalCrear(false)
      setNombreNuevoRol('')
      setTabActivo(data.data.name)
      cargarMatriz()
    } catch {
      setErrorCrear('Error de conexión')
    } finally {
      setCreando(false)
    }
  }

  async function handleEliminarRol(roleId: string, roleName: string) {
    if (!confirm(`¿Eliminar el rol "${roleName}"? Esta acción no se puede deshacer.`)) return
    setErrorEliminar(null)
    setEliminando(roleId)
    try {
      const res = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || data.error) { setErrorEliminar(data.error ?? 'Error al eliminar'); return }
      limpiarCachePermisos()
      const configurables = getRolesConfigurables(matriz.filter(r => r.role_id !== roleId), rolUsuarioActual)
      setTabActivo(configurables[0]?.role_name ?? null)
      cargarMatriz()
    } catch {
      setErrorEliminar('Error de conexión')
    } finally {
      setEliminando(null)
    }
  }

  if (cargando) return <p className="text-sm text-[var(--text-secondary)]">Cargando...</p>
  if (errorCarga) return <p className="text-sm text-red-500">{errorCarga}</p>

  const modulosProtegibles = MODULOS_SISTEMA.filter(m => m.protegible || MODULOS_SIEMPRE_ACTIVOS.includes(m.key))
  const rolesConfigurables = getRolesConfigurables(matriz, rolUsuarioActual)
  const rolActivo = matriz.find(r => r.role_name === tabActivo)
  const esRolPersonalizado = (r: MatrizPermisos) => r.restaurant_id !== null

  return (
    <div className="flex flex-col gap-4">
      {/* Mensajes de estado */}
      {mensajeGuardado && (
        <div className="text-sm text-green-600 font-medium">{mensajeGuardado}</div>
      )}
      {errorGuardado && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <span>{errorGuardado}</span>
          <button onClick={() => setErrorGuardado(null)} className="text-red-400 hover:text-red-600 text-xs underline">
            Cerrar
          </button>
        </div>
      )}
      {errorEliminar && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <span>{errorEliminar}</span>
          <button onClick={() => setErrorEliminar(null)} className="text-red-400 hover:text-red-600 text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Rol admin — siempre visible, no configurable */}
      {matriz.find(r => r.role_name === 'admin') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <span className="text-base">🛡️</span>
          <div className="flex-1">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Administrador</span>
            <span className="ml-2 text-xs text-[var(--text-secondary)] italic">Acceso total — no configurable</span>
          </div>
        </div>
      )}

      {rolesConfigurables.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">No hay roles configurables para tu nivel de acceso.</p>
      )}

      {/* Tabs de roles + botón crear */}
      <div className="flex items-end gap-1 border-b border-[var(--border)]">
        <div className="flex gap-1 flex-wrap flex-1">
          {rolesConfigurables.map(r => (
            <button
              key={r.role_id}
              onClick={() => setTabActivo(r.role_name)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
                tabActivo === r.role_name
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
              {esRolPersonalizado(r) && (
                <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">personalizado</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setModalCrear(true); setErrorCrear(null); setNombreNuevoRol('') }}
          className="mb-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Nuevo rol
        </button>
      </div>

      {/* Panel de permisos del rol activo */}
      {rolActivo && (
        <div className="flex flex-col gap-2">
          {/* Botón eliminar — disponible en todos los roles configurables */}
          <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
            <span className="text-xs text-[var(--text-secondary)]">
              {esRolPersonalizado(rolActivo) ? 'Rol personalizado' : 'Rol del sistema'}
            </span>
            <button
              onClick={() => handleEliminarRol(rolActivo.role_id, rolActivo.role_name)}
              disabled={eliminando === rolActivo.role_id}
              className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 transition-colors"
            >
              {eliminando === rolActivo.role_id ? 'Eliminando...' : 'Eliminar rol'}
            </button>
          </div>

          {modulosProtegibles.map(modulo => {
            const activo = rolActivo.permisos[modulo.key] ?? true
            const siempreActivo = MODULOS_SIEMPRE_ACTIVOS.includes(modulo.key)
            const guardandoEste = guardando[`${rolActivo.role_id}:${modulo.key}`] ?? false
            const disabled = siempreActivo || guardandoEste

            return (
              <div
                key={modulo.key}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]"
              >
                <span className="text-xl flex-shrink-0">{modulo.icono}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{modulo.label}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{modulo.descripcion}</p>
                  {siempreActivo && (
                    <p className="text-xs text-[var(--text-secondary)] italic">🔒 Obligatorio para todos los roles</p>
                  )}
                </div>
                <div className="flex-shrink-0 relative">
                  {guardandoEste && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <button
                    role="switch"
                    aria-checked={activo}
                    disabled={disabled}
                    onClick={() => !disabled && handleToggle(rolActivo.role_id, modulo.key, !activo)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${activo ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        activo ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear rol */}
      {modalCrear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          onClick={() => setModalCrear(false)}
        >
          <div
            className="bg-[var(--bg-surface)] rounded-xl shadow-2xl p-6 w-full max-w-sm border border-[var(--border)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Nuevo rol personalizado</h3>
              <div
                onClick={() => setModalCrear(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none cursor-pointer"
              >
                &times;
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              El nombre se convertirá a minúsculas. Solo letras, números, espacios y guiones.
            </p>
            <input
              type="text"
              value={nombreNuevoRol}
              onChange={e => setNombreNuevoRol(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCrearRol()}
              placeholder="Ej: Encargado de sala"
              maxLength={60}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            {errorCrear && (
              <p className="text-xs text-red-500 mb-3">{errorCrear}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModalCrear(false)}
                className="flex-1 px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearRol}
                disabled={creando}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {creando ? 'Creando...' : 'Crear rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
