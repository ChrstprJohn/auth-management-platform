import { ActionDetails } from './details';
import { Timestamp } from '@/components/timestamp';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { PageControls } from '@/components/page-controls';
import { Blank, Failure, Loading, Success } from '@/components/feedback/states';
import { useHistoryPage } from './hooks';
import { RefreshCw } from 'lucide-react';

export function HistoryPage() {
  const m = useHistoryPage();
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h1>Action history</h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Durable management attempts. Pending and unknown results remain
            unresolved and require trusted administrator reconciliation. A
            deleted target may lead to an account-not-found page.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={m.refreshing || m.state === 'loading'}
          onClick={m.refresh}
        >
          <RefreshCw className={m.refreshing ? 'animate-spin' : ''} />
          {m.refreshing ? 'Refreshing…' : 'Refresh history'}
        </Button>
      </div>
      {m.pagination.invalid && (
        <Success title="Pagination was normalized">
          Invalid values use safe defaults.{' '}
          <Button variant="outline" onClick={m.pagination.normalize}>
            Update address
          </Button>
        </Success>
      )}
      {m.error && <Failure error={m.error} retry={m.refresh} />}{' '}
      {m.refreshing && <p role="status">Refreshing history…</p>}
      {m.state === 'loading' ? (
        <Loading label="Loading durable action history" />
      ) : m.state === 'empty' ? (
        <Blank
          title="No action history on this page"
          description="Choose an earlier page or return to users. Read failures are shown separately."
        />
      ) : (
        m.data && (
          <div className="overflow-hidden rounded-xl border">
            <Table className="table-fixed">
              <TableCaption>
                Durable records on page {m.pagination.page}. No frontend
                reconciliation operation is available.
              </TableCaption>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="hidden sm:table-cell">Target</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Created
                  </TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <p className="capitalize">{entry.action}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.outcome === 'failed'
                            ? 'destructive'
                            : entry.outcome === 'succeeded'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {entry.outcome}
                      </Badge>
                      {(entry.outcome === 'pending' ||
                        entry.outcome === 'unknown') && (
                        <p className="text-xs">Unresolved</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span
                        title={entry.targetId ?? undefined}
                        className="font-mono text-xs"
                      >
                        {entry.targetId
                          ? `${entry.targetId.slice(0, 8)}…`
                          : 'Not known'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal sm:table-cell">
                      <Timestamp value={entry.createdAt} compact />
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionDetails entry={entry} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
      {m.state !== 'loading' && (
        <PageControls
          model={m.pagination}
          hasNext={m.data?.hasNextPage ?? false}
          pending={m.refreshing}
        />
      )}
    </section>
  );
}
