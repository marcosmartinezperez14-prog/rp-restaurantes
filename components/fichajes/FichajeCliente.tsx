'use client'

import { useState } from 'react'
import BotonFichaje from './BotonFichaje'
import HistorialFichajes from './HistorialFichajes'
import type { EstadoFichaje } from '@/types/fichajes'

interface Props {
  estadoInicial: EstadoFichaje
  isAdmin: boolean
}

export default function FichajeCliente({ estadoInicial, isAdmin }: Props) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="max-w-[430px] mx-auto">
      <BotonFichaje
        estadoInicial={estadoInicial}
        onFichajeCompleto={() => setRefreshKey(k => k + 1)}
      />
      <div className="mt-8">
        <HistorialFichajes isAdmin={isAdmin} refreshKey={refreshKey} />
      </div>
    </div>
  )
}
