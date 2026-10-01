import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';

export function useStatusPage() {
  const { runtime, generation } = useSession();
  const live = useQuery({
    queryKey: ['health', 'live'],
    queryFn: ({ signal }) => operatorApi.live(signal),
  });
  const ready = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: ({ signal }) => operatorApi.ready(signal),
  });
  const upstream = useQuery({
    queryKey: ['private', generation, 'upstream'],
    queryFn: ({ signal }) =>
      runtime.protectedCall(() => operatorApi.upstream(signal)),
  });
  const checks = [
    {
      label: 'API liveness',
      description: 'The API process can answer requests.',
      query: live,
      version: null,
    },
    {
      label: 'Dependency readiness',
      description: 'GoTrue and owned admin storage are available.',
      query: ready,
      version: null,
    },
    {
      label: 'GoTrue reachability',
      description: 'Authenticated upstream health and safe version.',
      query: upstream,
      version: upstream.error ? null : (upstream.data?.version ?? null),
    },
  ].map(({ query, ...check }) => ({
    ...check,
    error: query.error,
    status: query.isPending
      ? 'Checking…'
      : query.error
        ? 'Check failed'
        : (query.data?.status ?? 'Not checked'),
    refreshing: query.isFetching,
    checkedAt: Math.max(query.dataUpdatedAt, query.errorUpdatedAt),
    refresh: () => {
      void query.refetch();
    },
  }));
  return {
    checks,
    refreshAll: () => {
      void live.refetch();
      void ready.refetch();
      void upstream.refetch();
    },
    refreshing: checks.some((check) => check.refreshing),
  };
}
