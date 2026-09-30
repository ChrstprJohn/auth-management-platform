import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
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
      <Alert variant="destructive">
        <AlertTitle>Unable to load this page</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-destructive">{error}</p>
          <Button onClick={retry} variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  return null
}
