import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { usePagination } from '@/lib/query/pagination';

export function useUsersPage() {
  const { runtime, generation } = useSession();
  const pagination = usePagination();
  const query = useQuery({
    queryKey: [
      'private',
      generation,
      'users',
      pagination.page,
      pagination.perPage,
    ],
    queryFn: ({ signal }) =>
      runtime.protectedCall(() =>
        operatorApi.users(pagination.page, pagination.perPage, signal),
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
        : query.data?.users.length
          ? 'data'
          : 'empty',
    refreshing: query.isFetching && !query.isPending,
    refresh: () => {
      void query.refetch();
    },
  };
}
export function useUserDetails() {
  const { id: rawId = '' } = useParams();
  const parsed = z.uuid().safeParse(rawId);
  const id = parsed.success ? parsed.data.toLowerCase() : '';
  const { runtime, generation } = useSession();
  const query = useQuery({
    queryKey: ['private', generation, 'user', id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      runtime.protectedCall(() => operatorApi.user(id, signal)),
  });
  const missing =
    !id || (query.error instanceof ApiFailure && query.error.status === 404);
  return {
    id,
    user: query.data?.user,
    error: query.error,
    state: missing
      ? 'missing'
      : query.isPending
        ? 'loading'
        : query.data
          ? 'data'
          : 'error',
    refreshing: query.isFetching && !query.isPending,
    refresh: () => {
      void query.refetch();
    },
  };
}
