'use client'

import { useEffect, useRef, useState } from 'react'

interface OfflineIndicatorProps {
  isOnline: boolean
  pendingCount: number
}

export function OfflineIndicator({
  isOnline,
  pendingCount,
}: OfflineIndicatorProps) {
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOnline && pendingCount === 0) {
      timerRef.current = setTimeout(() => setVisible(false), 3000)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      setVisible(true)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isOnline, pendingCount])

  if (isOnline && pendingCount === 0 && !visible) return null

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 py-3 px-4 flex items-center gap-3 ${
        !isOnline ? 'bg-yellow-700' : 'bg-green-600'
      } text-white`}
    >
      {!isOnline ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          <line x1="4" y1="4" x2="20" y2="20" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      )}
      <span className="text-sm font-medium">
        {!isOnline
          ? `Sin conexión — ${pendingCount} operaciones en cola`
          : `Conexión restaurada — sincronizando ${pendingCount} operaciones...`}
      </span>
    </div>
  )
}
