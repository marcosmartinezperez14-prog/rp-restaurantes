'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { RolNombre, PERMISOS_POR_ROL } from '@/types/equipo'
import { usePermisos } from '@/lib/permisos/usePermisos'

interface Props {
  rol: RolNombre | null
  modulo: string
  moduloKey?: string
  children: React.ReactNode
}

export default function RutaProtegida({ rol, modulo, moduloKey, children }: Props) {
  const router = useRouter()
  const { tieneAcceso, loading } = usePermisos()

  const tieneAccesoEstatico = rol ? (PERMISOS_POR_ROL[rol]?.modulos.includes(modulo) ?? false) : false
  const tieneAccesoDB = moduloKey ? tieneAcceso(moduloKey) : true
  const accesoConcedido = tieneAccesoEstatico && tieneAccesoDB

  useEffect(() => {
    if (!tieneAccesoEstatico) {
      router.replace('/dashboard')
      return
    }
    if (!loading && moduloKey && !tieneAcceso(moduloKey)) {
      router.replace('/dashboard')
    }
  }, [tieneAccesoEstatico, loading, moduloKey, tieneAcceso, router])

  if (!tieneAccesoEstatico) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748b]">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  if (loading && moduloKey) return <>{children}</>

  if (!accesoConcedido) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748b]">No tienes acceso a este módulo.</p>
      </div>
    )
  }

  return <>{children}</>
}
