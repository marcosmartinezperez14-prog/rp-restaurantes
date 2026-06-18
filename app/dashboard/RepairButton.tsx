'use client'

import { useState, useTransition } from 'react'
import { repairExistingData, getDiagnostics } from '@/app/actions/onboarding'

export default function RepairButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  const [diag, setDiag] = useState<string | null>(null)

  function handleRepair() {
    setResult(null)
    startTransition(async () => {
      const res = await repairExistingData()
      if (res.error) {
        setResult(`Error: ${res.error}`)
      } else {
        setResult(`Reparación completada (${res.fixed} registros). Recarga el TPV.`)
      }
    })
  }

  function handleDiag() {
    setDiag(null)
    startTransition(async () => {
      const res = await getDiagnostics()
      setDiag(JSON.stringify(res.raw, null, 2))
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRepair}
        disabled={isPending}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors text-sm"
      >
        {isPending ? 'Procesando...' : 'Reparar datos del TPV'}
      </button>
      <button
        onClick={handleDiag}
        disabled={isPending}
        className="w-full py-2 bg-[var(--bg-page)] hover:bg-gray-200 text-[var(--text-secondary)] font-medium rounded-xl disabled:opacity-50 transition-colors text-xs"
      >
        Ver diagnóstico BD
      </button>
      {result && (
        <p className="text-xs text-center text-[var(--text-secondary)] px-2">{result}</p>
      )}
      {diag && (
        <pre className="text-[10px] text-left bg-[var(--bg-page)] border border-[var(--border)] rounded-lg p-2 overflow-auto max-h-64 text-[var(--text-primary)]">
          {diag}
        </pre>
      )}
    </div>
  )
}
