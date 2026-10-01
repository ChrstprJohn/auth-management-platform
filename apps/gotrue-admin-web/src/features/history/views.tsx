import { Link } from 'react-router-dom';
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
import { CopyId } from '@/components/copy-id';
import { Timestamp } from '@/components/timestamp';
import { PageControls } from '@/components/page-controls';
import { Blank, Failure, Loading, Success } from '@/components/feedback/states';
import { useHistoryPage } from './hooks';

export function HistoryPage() {
  const m = useHistoryPage();
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Action history</h1>
        <Button
          variant="outline"
          disabled={m.refreshing || m.state === 'loading'}
          onClick={m.refresh}
        >
          {m.refreshing ? 'Refreshing…' : 'Refresh history'}
        </Button>
      </div>
      <p className="max-w-prose text-muted-foreground">
        Durable management attempts. Pending and unknown results remain
        unresolved and require trusted administrator reconciliation. A deleted
        target may lead to an account-not-found page.
      </p>
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
          <Table>
            <TableCaption>
              Durable records on page {m.pagination.page}. No frontend
              reconciliation operation is available.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Action / outcome</TableHead>
                <TableHead>Actor UUID</TableHead>
                <TableHead>Target UUID</TableHead>
                <TableHead>Created / completed</TableHead>
                <TableHead>Audit / request IDs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.data.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <p className="capitalize">{entry.action}</p>
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
                  <TableCell className="max-w-64 whitespace-normal">
                    <CopyId value={entry.actorId} label="actor UUID" />
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    {entry.targetId ? (
                      <>
                        <CopyId value={entry.targetId} label="target UUID" />
                        <Link
                          className="block underline"
                          to={`/users/${entry.targetId}`}
                        >
                          Inspect target
                        </Link>
                      </>
                    ) : (
                      'Not known'
                    )}
                  </TableCell>
                  <TableCell>
                    <p>
                      Created: <Timestamp value={entry.createdAt} />
                    </p>
                    <p>
                      Completed: <Timestamp value={entry.completedAt} />
                    </p>
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    <p>
                      Audit: <CopyId value={entry.id} label="audit ID" />
                    </p>
                    <p>
                      Request:{' '}
                      <CopyId value={entry.requestId} label="request ID" />
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
