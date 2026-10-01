import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type { usePagination } from '@/lib/query/pagination';

export function PageControls({
  model,
  hasNext,
  pending,
}: {
  model: ReturnType<typeof usePagination>;
  hasNext: boolean;
  pending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <label className="flex items-center gap-2 text-sm">
        Rows per page
        <NativeSelect
          aria-label="Rows per page"
          value={model.perPage}
          disabled={pending}
          onChange={(event) => model.resize(event.target.value)}
        >
          {Array.from(new Set([10, 20, 50, 100, model.perPage]))
            .sort((a, b) => a - b)
            .map((size) => (
              <NativeSelectOption key={size} value={size}>
                {size}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </label>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="outline"
              disabled={pending || model.page <= 1}
              onClick={model.previous}
            >
              Previous
            </Button>
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 text-sm tabular-nums" aria-current="page">
              Page {model.page}
            </span>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              disabled={pending || !hasNext || model.page >= 10000}
              onClick={model.next}
            >
              Next
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
