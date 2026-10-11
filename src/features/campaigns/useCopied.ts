import { useEffect, useRef, useState } from 'react'

/** A "copied" flag that clears itself, for the feedback of a copy button. */
export function useCopied(durationMs = 2000): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function flash() {
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), durationMs)
  }

  return [copied, flash]
}
