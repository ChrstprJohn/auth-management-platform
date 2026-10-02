import { useQuery } from '@tanstack/react-query';
import type { AuditEntry, SafeUser } from '@auth/contracts';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { useStatusPage } from '@/features/status/hooks';
import { validDate, actionName } from '@/lib/format/display';

export function summarizeUsers(users: SafeUser[]) {
  return {
    confirmation: [
      {
        label: 'Confirmed',
        count: users.filter((user) => user.emailConfirmedAt !== null).length,
      },
      {
        label: 'Not reported',
        count: users.filter((user) => user.emailConfirmedAt === null).length,
      },
    ],
    bans: [
      {
        label: 'Banned',
        count: users.filter((user) => user.isBanned === true).length,
      },
      {
        label: 'Not banned',
        count: users.filter((user) => user.isBanned === false).length,
      },
      {
        label: 'Unknown',
        count: users.filter((user) => user.isBanned === null).length,
      },
    ].map((row) => ({
      ...row,
      percentage: users.length ? (row.count / users.length) * 100 : 0,
    })),
  };
}
export function summarizeAudit(entries: AuditEntry[]) {
  const days = new Map<
    string,
    { date: string; attempts: number; unresolved: number }
  >();
  for (const entry of entries) {
    const timestamp = validDate(entry.createdAt);
    if (!timestamp) continue;
    const date = new Date(
      timestamp.getFullYear(),
      timestamp.getMonth(),
      timestamp.getDate(),
    ).toISOString();
    const day = days.get(date) ?? { date, attempts: 0, unresolved: 0 };
    day.attempts++;
    if (entry.outcome === 'pending' || entry.outcome === 'unknown')
      day.unresolved++;
    days.set(date, day);
  }
  return {
    daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    outcomes: (['succeeded', 'failed', 'pending', 'unknown'] as const).map(
      (outcome) => ({
        label: outcome,
        count: entries.filter((entry) => entry.outcome === outcome).length,
      }),
    ),
    actions: (
      [
        'create',
        'ban',
        'unban',
        'delete',
        'invite',
        'send_verification',
      ] as const
    ).map((action) => ({
      label: actionName(action),
      count: entries.filter((entry) => entry.action === action).length,
    })),
    unresolved: entries.filter(
      (entry) => entry.outcome === 'pending' || entry.outcome === 'unknown',
    ).length,
  };
}

export function useDashboard() {
  const { runtime, generation } = useSession();
  const users = useQuery({
    queryKey: ['private', generation, 'users', 1, 20],
    queryFn: ({ signal }) =>
      runtime.protectedCall(() => operatorApi.users(1, 20, signal)),
  });
  const audit = useQuery({
    queryKey: ['private', generation, 'history', 1, 20],
    queryFn: ({ signal }) =>
      runtime.protectedCall(() => operatorApi.history(1, 20, signal)),
  });
  const health = useStatusPage();
  return {
    users: {
      data: users.data,
      error: users.error,
      loading: users.isPending,
      refreshing: users.isFetching,
      checkedAt: users.dataUpdatedAt,
      summary: users.data ? summarizeUsers(users.data.users) : null,
      refresh: () => {
        void users.refetch();
      },
    },
    audit: {
      data: audit.data,
      error: audit.error,
      loading: audit.isPending,
      refreshing: audit.isFetching,
      checkedAt: audit.dataUpdatedAt,
      summary: audit.data ? summarizeAudit(audit.data.entries) : null,
      refresh: () => {
        void audit.refetch();
      },
    },
    health,
    refreshing: users.isFetching || audit.isFetching || health.refreshing,
    refresh: () => {
      void users.refetch();
      void audit.refetch();
      health.refreshAll();
    },
  };
}
