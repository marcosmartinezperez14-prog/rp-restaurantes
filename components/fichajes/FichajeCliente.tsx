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
    <div style={{
      minHeight: '100vh', width: '100%', background: '#f6f6f7',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '36px 24px 64px',
    }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <BotonFichaje
          estadoInicial={estadoInicial}
          onFichajeCompleto={() => setRefreshKey(k => k + 1)}
        />
        <HistorialFichajes isAdmin={isAdmin} refreshKey={refreshKey} />
      </div>
    </div>
  )
}
