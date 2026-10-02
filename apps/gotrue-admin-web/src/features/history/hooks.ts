import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { ApiFailure } from '@/lib/api/client';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { usePagination, parsePagination } from '@/lib/query/pagination';

export function historySearch(pagination: { page: number; perPage: number }) {
  return `?page=${pagination.page}&perPage=${pagination.perPage}`;
}

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

export function useHistoryDetails() {
  const { id: rawId = '' } = useParams();
  const parsed = z.uuid().safeParse(rawId);
  const id = parsed.success ? parsed.data.toLowerCase() : '';
  const { runtime, generation, session } = useSession();
  const [params] = useSearchParams();
  const back =
    '/history' + (params.size ? historySearch(parsePagination(params)) : '');
  const query = useQuery({
    queryKey: ['private', generation, 'history-entry', id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      runtime.protectedCall(() => operatorApi.historyEntry(id, signal)),
  });
  const entry = query.data?.entry;
  const deleted = entry?.action === 'delete' && entry.outcome === 'succeeded';
  const targetId = entry?.targetId;
  const target = useQuery({
    queryKey: ['private', generation, 'user', targetId],
    enabled: !!targetId && !deleted,
    queryFn: ({ signal }) =>
      runtime.protectedCall(() => operatorApi.user(targetId ?? '', signal)),
  });
  const targetMissing =
    target.error instanceof ApiFailure && target.error.status === 404;
  const missing =
    !id || (query.error instanceof ApiFailure && query.error.status === 404);
  return {
    back,
    entry,
    actor:
      session && entry?.actorId === session.operator.id
        ? session.operator.email
        : 'Operator identity recorded',
    target: target.data?.user,
    targetState: !targetId
      ? 'unknown'
      : deleted
        ? 'deleted'
        : targetMissing
          ? 'missing'
          : target.isPending
            ? 'loading'
            : target.isError
              ? 'error'
              : 'data',
    targetError: target.error,
    state: missing
      ? 'missing'
      : query.isPending
        ? 'loading'
        : query.data
          ? 'data'
          : 'error',
    error: query.error,
    refreshing: query.isFetching && !query.isPending,
    refresh: () => {
      void query.refetch();
    },
    refreshTarget: () => {
      void target.refetch();
    },
  };
}
