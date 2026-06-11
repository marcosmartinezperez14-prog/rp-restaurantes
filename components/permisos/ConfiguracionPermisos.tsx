'use client'

import { useEffect, useState } from 'react'
import type { MatrizPermisos } from '@/types/permisos'
import { MODULOS_SISTEMA, MODULOS_SIEMPRE_ACTIVOS, ROLES_PROTEGIDOS, SOLO_ADMIN_PUEDE_CONFIGURAR } from '@/lib/permisos/modulos'

interface Props {
  rolUsuarioActual: 'admin' | 'gerente'
}

const ORDEN_ROLES = ['admin', 'gerente', 'camarero', 'cocinero', 'contable']

export default function ConfiguracionPermisos({ rolUsuarioActual }: Props) {
  const [matriz, setMatriz] = useState<MatrizPermisos[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabActivo, setTabActivo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/permisos/rol')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        const ordenada = [...(data.data as MatrizPermisos[])].sort(
          (a, b) => ORDEN_ROLES.indexOf(a.role_name) - ORDEN_ROLES.indexOf(b.role_name)
        )
        setMatriz(ordenada)
        const configurables = getRolesConfigurables(ordenada, rolUsuarioActual)
        if (configurables.length > 0) setTabActivo(configurables[0].role_name)
      })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setCargando(false))
  }, [rolUsuarioActual])

  function getRolesConfigurables(m: MatrizPermisos[], rolActual: 'admin' | 'gerente'): MatrizPermisos[] {
    return m.filter(r => {
      if (ROLES_PROTEGIDOS.includes(r.role_name)) return false
      if (rolActual === 'gerente' && SOLO_ADMIN_PUEDE_CONFIGURAR.includes(r.role_name)) return false
      return true
    })
  }

  async function handleToggle(roleId: string, moduloKey: string, nuevoActivo: boolean) {
    const guardandoKey = `${roleId}:${moduloKey}`

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
        setError(data.error ?? 'Error al guardar')
        return
      }
      setMensajeGuardado('Guardado')
      setTimeout(() => setMensajeGuardado(null), 2000)
    } catch {
      setMatriz(prev => prev.map(r =>
        r.role_id === roleId
          ? { ...r, permisos: { ...r.permisos, [moduloKey]: !nuevoActivo } }
          : r
      ))
      setError('Error de conexión')
    } finally {
      setGuardando(prev => ({ ...prev, [guardandoKey]: false }))
    }
  }

  if (cargando) return <p className="text-sm text-[var(--text-secondary)]">Cargando...</p>
  if (error) return <p className="text-sm text-red-500">{error}</p>

  const modulosProtegibles = MODULOS_SISTEMA.filter(m => m.protegible)
  const rolesConfigurables = getRolesConfigurables(matriz, rolUsuarioActual)
  const rolActivo = matriz.find(r => r.role_name === tabActivo)

  return (
    <div className="flex flex-col gap-4">
      {mensajeGuardado && (
        <div className="text-sm text-green-600 font-medium">{mensajeGuardado}</div>
      )}

      {matriz.find(r => r.role_name === 'admin') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <span className="text-base">🛡️</span>
          <div className="flex-1">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Administrador</span>
            <span className="ml-2 text-xs text-[var(--text-secondary)] italic">Acceso total — no configurable</span>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-[var(--border)]">
        {rolesConfigurables.map(r => (
          <button
            key={r.role_id}
            onClick={() => setTabActivo(r.role_name)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tabActivo === r.role_name
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
          </button>
        ))}
      </div>

      {rolActivo && (
        <div className="flex flex-col gap-2">
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
    </div>
  )
}
