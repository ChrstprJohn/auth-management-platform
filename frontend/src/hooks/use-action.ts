import { useRef, useState } from 'react'

export function useAction() {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function perform<T>(operation: () => Promise<T>, onSuccess?: (value: T) => void) {
    if (running.current) return false
    running.current = true
    setBusy(true)
    setError('')
    try {
      const result = await operation()
      onSuccess?.(result)
      return true
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Operation failed. Try again.')
      return false
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return { busy, error, perform }
}
