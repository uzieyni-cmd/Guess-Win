'use client'
import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-amber-950 text-xs font-semibold py-2 flex items-center justify-center gap-2">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      אין חיבור לאינטרנט
    </div>
  )
}
