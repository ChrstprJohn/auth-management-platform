import { Button } from '@/components/ui/button'
export function Pagination({
  page,
  hasMore,
  disabled,
  onChange,
}: {
  page: number
  hasMore: boolean
  disabled: boolean
  onChange: (page: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        disabled={disabled || page === 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm">Page {page}</span>
      <Button variant="outline" disabled={disabled || !hasMore} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </div>
  )
}
