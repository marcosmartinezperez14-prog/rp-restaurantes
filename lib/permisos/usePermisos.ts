'use client'

import { useEffect, useState } from 'react'
import type { PermisosUsuario, RespuestaMios } from '@/types/permisos'

const CACHE_KEY = 'rp_permisos_usuario'
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  timestamp: number
  data: RespuestaMios
}

function leerCache(): RespuestaMios | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

function escribirCache(data: RespuestaMios) {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), data }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

export function limpiarCachePermisos() {
  try { sessionStorage.removeItem(CACHE_KEY) } catch {}
}

export function usePermisos() {
  const [permisos, setPermisos] = useState<PermisosUsuario>({})
  const [rol, setRol] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = leerCache()
    if (cached) {
      setRol(cached.rol)
      setPermisos(cached.permisos)
      setLoading(false)
      return
    }

    fetch('/api/permisos/mios')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: RespuestaMios) => {
        if (!data || typeof data.permisos !== 'object' || data.permisos === null) return
        escribirCache(data)
        setRol(data.rol)
        setPermisos(data.permisos)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function tieneAcceso(modulo_key: string): boolean {
    if (loading) return true
    if (!(modulo_key in permisos)) return true
    return permisos[modulo_key] !== false
  }

  return { permisos, rol, loading, tieneAcceso }
}
