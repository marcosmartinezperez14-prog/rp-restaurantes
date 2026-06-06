'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { RolNombre, PERMISOS_POR_ROL } from '@/types/equipo'

interface Props {
  rol: RolNombre | null
  modulo: string
  children: React.ReactNode
}

export default function RutaProtegida({ rol, modulo, children }: Props) {
  const router = useRouter()
  const tieneAcceso = rol ? PERMISOS_POR_ROL[rol]?.modulos.includes(modulo) : false

  useEffect(() => {
    if (!tieneAcceso) {
      router.replace('/dashboard')
    }
  }, [tieneAcceso, router])

  if (!tieneAcceso) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748b]">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  return <>{children}</>
}
