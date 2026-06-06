'use client'
import { RolNombre, PERMISOS_POR_ROL } from '@/types/equipo'

export function usePermisos(rol: RolNombre | null) {
  const puedeAcceder = (modulo: string): boolean => {
    if (!rol) return false
    return PERMISOS_POR_ROL[rol]?.modulos.includes(modulo) ?? false
  }

  const esAdmin = rol === 'admin'
  const esGerente = rol === 'gerente' || rol === 'admin'
  const puedeGestionarEquipo = esGerente

  return { puedeAcceder, esAdmin, esGerente, puedeGestionarEquipo }
}
