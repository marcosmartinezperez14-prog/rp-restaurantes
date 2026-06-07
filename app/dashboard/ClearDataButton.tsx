'use client'

import { useState, useTransition } from 'react'
import { clearAllData } from '@/app/actions/admin'

export default function ClearDataButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    setResult(null)
    setConfirmed(false)
    startTransition(async () => {
      const res = await clearAllData()
      if (res.error) {
        setResult(`Error: ${res.error}`)
      } else {
        const total = Object.values(res.deleted).reduce((a, b) => a + b, 0)
        setResult(`Listo. ${total} registros eliminados.`)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 mt-4">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`w-full py-2.5 font-semibold rounded-xl disabled:opacity-50 transition-colors text-sm ${
          confirmed
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-red-100 hover:bg-red-200 text-red-700'
        }`}
      >
        {isPending
          ? 'Eliminando...'
          : confirmed
            ? '¿Seguro? Pulsa de nuevo para confirmar'
            : 'Limpiar todos los datos'}
      </button>
      {confirmed && !isPending && (
        <button
          onClick={() => setConfirmed(false)}
          className="text-xs text-gray-400 hover:text-gray-600 text-center"
        >
          Cancelar
        </button>
      )}
      {result && (
        <p className="text-xs text-center text-gray-600 px-2">{result}</p>
      )}
    </div>
  )
}
