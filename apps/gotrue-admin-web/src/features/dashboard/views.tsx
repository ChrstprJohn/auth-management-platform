import { Link } from 'react-router-dom';
import {
  ConfirmationChart,
  OutcomeChart,
  ActivityChart,
  BanBreakdown,
  DailyActivity,
} from './charts';
import { ArrowUpRight, RefreshCw, MoreHorizontal } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardAction,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HealthBadge } from '@/components/health-badge';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Blank, Failure, Loading } from '@/components/feedback/states';
import { Timestamp } from '@/components/timestamp';
import { ActionDetails } from '@/features/history/details';
import { PageHeader } from '@/components/page-header';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useDashboard } from './hooks';

export function DashboardPage() {
  const m = useDashboard();
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Dashboard"
        description="A snapshot of the first 20 users and 20 recent audit records. These charts describe the loaded pages, not global totals or growth."
        actions={
          <Button variant="outline" disabled={m.refreshing} onClick={m.refresh}>
            <RefreshCw className={m.refreshing ? 'animate-spin' : ''} />
            {m.refreshing ? 'Refreshing snapshot…' : 'Refresh snapshot'}
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: 'Users loaded',
            value: m.users.data?.users.length,
            description: 'First page · maximum 20',
            href: '/users',
          },
          {
            title: 'Confirmed emails',
            value: m.users.summary?.confirmation[0]?.count,
            description: 'Within the loaded user page',
            href: '/users',
          },
          {
            title: 'Unresolved attempts',
            value: m.audit.summary?.unresolved,
            description: 'Pending or unknown · audit page',
            href: '/history',
          },
          {
            title: 'Failed attempts',
            value: m.audit.summary?.outcomes[1]?.count,
            description: 'Reported failures · audit page',
            href: '/history',
          },
        ].map((metric) => (
          <Card key={metric.title} className="min-w-0">
            <CardHeader>
              <CardDescription className="min-w-0">
                {metric.title}
              </CardDescription>
              <CardAction>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" />}
                    aria-label={`Actions for ${metric.title}`}
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem render={<Link to={metric.href} />}>
                      View{' '}
                      {metric.href === '/users' ? 'users' : 'action history'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardAction>
              <CardTitle className="text-3xl tabular-nums">
                {metric.value ?? '—'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                to={metric.href}
                className="text-xs text-muted-foreground underline"
              >
                {metric.description}
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      {(m.users.error || m.audit.error) && (
        <p role="status" className="text-sm text-muted-foreground">
          Some reads failed. Available counts show the last loaded snapshot; see
          errors below.
        </p>
      )}
      {m.audit.summary && !!m.audit.data?.entries.length && (
        <DailyActivity data={m.audit.summary.daily} />
      )}
      <section aria-labelledby="dashboard-health" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="dashboard-health">Service signals</h2>
          <Link
            to="/status"
            className="inline-flex items-center gap-1 text-sm underline"
          >
            View service status
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-0 rounded-xl border md:grid-cols-3">
          {m.health.checks.map((check) => (
            <div
              key={check.label}
              className="min-w-0 space-y-2 border-b p-4 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{check.label}</span>
                <HealthBadge status={check.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                Last check:{' '}
                <Timestamp
                  value={
                    check.checkedAt
                      ? new Date(check.checkedAt).toISOString()
                      : null
                  }
                />
              </p>
              {check.error && (
                <Failure error={check.error} retry={check.refresh} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Health does not prove email delivery, login or end-to-end persistence.
        </p>
      </section>
      <section aria-labelledby="dashboard-users" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="dashboard-users">User snapshot</h2>
            <p className="text-sm text-muted-foreground">
              {m.users.data
                ? `${m.users.data.users.length} records loaded · page 1 · limit 20${m.users.data.hasNextPage ? ' · more pages available' : ''}`
                : 'First user page · limit 20'}
              {m.users.refreshing && m.users.data ? ' · refreshing' : ''}
            </p>
          </div>
          <Link
            to="/users"
            className="inline-flex items-center gap-1 text-sm underline"
          >
            Browse users
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        {m.users.error && (
          <Failure error={m.users.error} retry={m.users.refresh} />
        )}
        {m.users.loading ? (
          <Loading label="Loading user snapshot" />
        ) : m.users.data?.users.length === 0 ? (
          <Blank
            title="No users in this snapshot"
            description="The first user page is empty."
          />
        ) : (
          m.users.summary && (
            <>
              <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-7">
                <div className="min-w-0 lg:col-span-4 [&>div]:h-full">
                  <ConfirmationChart data={m.users.summary.confirmation} />
                </div>
                <div className="min-w-0 lg:col-span-3 [&>div]:h-full">
                  <BanBreakdown data={m.users.summary.bans} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Last loaded:{' '}
                <Timestamp
                  value={
                    m.users.checkedAt
                      ? new Date(m.users.checkedAt).toISOString()
                      : null
                  }
                />
                {m.users.error && ' · showing the last loaded snapshot'}
              </p>
            </>
          )
        )}
      </section>
      <section aria-labelledby="dashboard-audit" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 id="dashboard-audit">Action snapshot</h2>
            <p className="text-sm text-muted-foreground">
              {m.audit.data
                ? `${m.audit.data.entries.length} recent records loaded · page 1 · limit 20${m.audit.data.hasNextPage ? ' · more pages available' : ''}`
                : 'First audit page · limit 20'}
              {m.audit.refreshing && m.audit.data ? ' · refreshing' : ''}
            </p>
          </div>
          <Link
            to="/history"
            className="inline-flex items-center gap-1 text-sm underline"
          >
            View action history
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        {m.audit.error && (
          <Failure error={m.audit.error} retry={m.audit.refresh} />
        )}
        {m.audit.loading ? (
          <Loading label="Loading action snapshot" />
        ) : m.audit.data?.entries.length === 0 ? (
          <Blank
            title="No actions in this snapshot"
            description="The first audit page is empty."
            href="/history"
            action="View action history"
          />
        ) : (
          m.audit.summary && (
            <>
              <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-7">
                <div className="min-w-0 lg:col-span-3 [&>div]:h-full">
                  <OutcomeChart
                    data={m.audit.summary.outcomes}
                    unresolved={m.audit.summary.unresolved}
                  />
                </div>
                <div className="min-w-0 lg:col-span-4 [&>div]:h-full">
                  <ActivityChart data={m.audit.summary.actions} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Last loaded:{' '}
                <Timestamp
                  value={
                    m.audit.checkedAt
                      ? new Date(m.audit.checkedAt).toISOString()
                      : null
                  }
                />
                {m.audit.error && ' · showing the last loaded snapshot'}
              </p>
            </>
          )
        )}
      </section>
      {m.audit.data && m.audit.data.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Recent attempts</h2>
            </CardTitle>
            <CardDescription>
              The five newest entries from the loaded audit page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="hidden lg:table-cell">Target</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Created
                  </TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.audit.data.entries.slice(0, 5).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap capitalize font-medium">
                      {entry.action}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.outcome === 'failed' ? 'destructive' : 'outline'
                        }
                      >
                        {entry.outcome}
                      </Badge>
                      {(entry.outcome === 'pending' ||
                        entry.outcome === 'unknown') && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Unresolved
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span
                        title={entry.targetId ?? undefined}
                        className="font-mono text-xs"
                      >
                        {entry.targetId
                          ? `${entry.targetId.slice(0, 8)}…`
                          : 'Not known'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal lg:table-cell">
                      <Timestamp value={entry.createdAt} compact />
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionDetails entry={entry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <Link to="/history" className="text-sm underline">
              Inspect durable action history
            </Link>
          </CardFooter>
        </Card>
      )}
    </section>
  );
}
