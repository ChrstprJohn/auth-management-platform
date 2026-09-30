import { useEffect, useState } from 'react'
export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{
    data?: T
    error?: string
    loading: boolean
    source?: typeof load
  }>({ loading: true })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    load().then(
      (data) => {
        if (active) setState({ data, loading: false, source: load })
      },
      (error) => {
        if (active)
          setState({
            error: error instanceof Error ? error.message : 'Request failed',
            loading: false,
            source: load,
          })
      }
    )
    return () => {
      active = false
    }
  }, [load, version])
  const current =
    state.source === load ? state : { loading: true, data: undefined, error: undefined }
  return {
    ...current,
    reload: () => {
      setState({ loading: true })
      setVersion((value) => value + 1)
    },
  }
}
