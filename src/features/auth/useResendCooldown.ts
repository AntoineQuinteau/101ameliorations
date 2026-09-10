import { useEffect, useRef, useState } from 'react'

const RESEND_COOLDOWN_SECONDS = 60

/** Drives a "resend code" cooldown: `secondsLeft` counts down to 0 once
 * `start()` is called, and the resend button stays disabled until then. */
export function useResendCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function start() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setSecondsLeft(RESEND_COOLDOWN_SECONDS)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 0
        }
        return current - 1
      })
    }, 1000)
  }

  return { secondsLeft, start }
}
