import { useEffect, useState } from 'react'

// The time now, read again every minute and whenever the Owner comes back to the app: a Home
// Screen app can stay open for days, while today and this week move on.
export function useNow(): Date {
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
  return now
}
