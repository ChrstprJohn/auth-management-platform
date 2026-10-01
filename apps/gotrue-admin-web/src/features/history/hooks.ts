import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { usePagination } from '@/lib/query/pagination';

export function useHistoryPage() {
  const { runtime, generation } = useSession();
  const pagination = usePagination();
  const query = useQuery({
    queryKey: [
      'private',
      generation,
      'history',
      pagination.page,
      pagination.perPage,
    ],
    queryFn: ({ signal }) =>
      runtime.protectedCall(() =>
        operatorApi.history(pagination.page, pagination.perPage, signal),
      ),
  });
  return {
    pagination,
    data: query.data,
    error: query.error,
    state: query.isPending
      ? 'loading'
      : !query.data && query.isError
        ? 'error'
        : query.data?.entries.length
          ? 'data'
          : 'empty',
    refreshing: query.isFetching && !query.isPending,
    refresh: () => {
      void query.refetch();
    },
  };
}
