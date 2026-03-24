import { useEffect, useState } from 'react'

const LOCK_BEFORE_MS = 10 * 60 * 1000 // 10 minutes

interface CountdownResult {
  timeLeft: number // ms remaining until lock
  isLocked: boolean
  formatted: string // HH:MM:SS
}

export function useCountdown(matchStartTime: string): CountdownResult {
  const lockTime = new Date(matchStartTime).getTime() - LOCK_BEFORE_MS

  const computeTimeLeft = () => Math.max(0, lockTime - Date.now())

  const [timeLeft, setTimeLeft] = useState(computeTimeLeft)

  useEffect(() => {
    if (timeLeft <= 0) return
    const interval = setInterval(() => {
      const remaining = computeTimeLeft()
      setTimeLeft(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchStartTime])

  const isLocked = timeLeft <= 0

  const totalSeconds = Math.floor(timeLeft / 1000)
  const days    = Math.floor(totalSeconds / 86400)
  const hours   = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formatted = days > 0
    ? `${days} ימים ו-${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} שעות`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return { timeLeft, isLocked, formatted }
}
