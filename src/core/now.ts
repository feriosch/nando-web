import { useEffect, useState } from 'react'

// The time now, read again every minute and whenever the Owner comes back to the app: a Home
// Screen app can stay open for days, while today and this week move on. The second value reads it
// again right away, such as just before a Save, and answers it.
export function useNow(): [Date, () => Date] {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    const interval = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
    }
  }, [])
  const refresh = () => {
    const now = new Date()
    setNow(now)
    return now
  }
  return [now, refresh]
}
