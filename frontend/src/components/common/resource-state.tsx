import { Button } from '@/components/ui/button'
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean
  error?: string
  retry: () => void
}) {
  if (loading)
    return (
      <p role="status" className="py-8 text-muted-foreground">
        Loading…
      </p>
    )
  if (error)
    return (
      <div role="alert" className="space-y-3 py-6">
        <p className="text-destructive">{error}</p>
        <Button onClick={retry} variant="outline">
          Try again
        </Button>
      </div>
    )
  return null
}
