'use client'
import { useEffect } from 'react'
import { startSyncListener } from '@/lib/offline/syncQueue'

export function SyncStarter() {
  useEffect(() => {
    const cleanup = startSyncListener()
    return cleanup
  }, [])
  return null
}
