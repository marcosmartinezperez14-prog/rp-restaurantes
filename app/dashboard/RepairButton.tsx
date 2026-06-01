'use client'

import { useState, useTransition } from 'react'
import { repairExistingData } from '@/app/actions/onboarding'

export default function RepairButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function handleRepair() {
    setResult(null)
    startTransition(async () => {
      const res = await repairExistingData()
      if (res.error) {
        setResult(`Error: ${res.error}`)
      } else {
        setResult(`Datos corregidos (${res.fixed} registros). Recarga el TPV.`)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRepair}
        disabled={isPending}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors text-sm"
      >
        {isPending ? 'Reparando...' : 'Reparar datos del TPV'}
      </button>
      {result && (
        <p className="text-xs text-center text-gray-600 px-2">{result}</p>
      )}
    </div>
  )
}
