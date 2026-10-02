import type { AuditEntry } from '@auth/contracts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyId } from '@/components/copy-id';
import { Timestamp } from '@/components/timestamp';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Blank, Failure, Loading } from '@/components/feedback/states';
import { actionName } from '@/lib/format/display';
import { MoreHorizontal, Eye, ArrowLeft } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useHistoryDetails } from './hooks';

export function ActionDetails({
  entry,
  search = '',
}: {
  entry: AuditEntry;
  search?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`Actions for action ${entry.id}`}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          aria-label={`View ${actionName(entry.action)} ${entry.id}`}
          render={<Link to={`/history/${entry.id}${search}`} />}
        >
          <Eye />
          View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HistoryDetailsPage() {
  const m = useHistoryDetails();
  const entry = m.entry;
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Action details"
        actions={
          <Button
            role="link"
            variant="outline"
            nativeButton={false}
            render={<Link to={m.back} />}
          >
            <ArrowLeft />
            Back to history
          </Button>
        }
      />
      {m.state === 'missing' ? (
        <Blank
          title="Action not found"
          description="This record is missing or the ID is invalid."
          href={m.back}
          action="View history"
        />
      ) : m.state === 'loading' ? (
        <Loading label="Loading action details" />
      ) : (
        <>
          {m.error && <Failure error={m.error} retry={m.refresh} />}
          {m.refreshing && <p role="status">Refreshing action…</p>}
          {entry && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>{actionName(entry.action)}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <dl className="grid min-w-0 gap-6 sm:grid-cols-2 [&_dt]:mb-1 [&_dt]:text-sm [&_dt]:text-muted-foreground">
                    <div>
                      <dt>Outcome</dt>
                      <dd>
                        <Badge
                          variant={
                            entry.outcome === 'failed'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {entry.outcome}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt>Actor</dt>
                      <dd className="break-all">{m.actor}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>
                        <Timestamp value={entry.createdAt} />
                      </dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>
                        <Timestamp value={entry.completedAt} />
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt>Target account</dt>
                      <dd>
                        {m.targetState === 'loading' ? (
                          <span role="status">Loading target account…</span>
                        ) : m.targetState === 'deleted' ? (
                          'Deleted by this action'
                        ) : m.targetState === 'missing' ? (
                          'Account is unavailable or has since been deleted.'
                        ) : m.targetState === 'unknown' ? (
                          'No target recorded'
                        ) : m.targetState === 'error' ? (
                          <Failure
                            error={m.targetError}
                            retry={m.refreshTarget}
                          />
                        ) : (
                          m.target && (
                            <Link
                              className="break-all underline underline-offset-4"
                              to={`/users/${m.target.id}`}
                            >
                              {m.target.email ?? 'View target account'}
                            </Link>
                          )
                        )}
                      </dd>
                    </div>
                  </dl>
                  {(entry.outcome === 'pending' ||
                    entry.outcome === 'unknown') && (
                    <p role="status" className="text-sm">
                      This result is unresolved. The action may have applied; a
                      trusted administrator must inspect it before any repeat
                      attempt.
                    </p>
                  )}
                  {entry.outcome === 'failed' && (
                    <p className="text-sm">
                      This attempt was recorded as failed. No failure reason is
                      available in this record.
                    </p>
                  )}
                </CardContent>
              </Card>
              <details className="min-w-0 rounded-xl border p-4">
                <summary className="cursor-pointer font-medium">
                  Technical details
                </summary>
                <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground">
                  <div>
                    <dt>Audit ID</dt>
                    <dd>
                      <CopyId value={entry.id} label="audit ID" />
                    </dd>
                  </div>
                  <div>
                    <dt>Request ID</dt>
                    <dd>
                      <CopyId value={entry.requestId} label="request ID" />
                    </dd>
                  </div>
                  <div>
                    <dt>Actor UUID</dt>
                    <dd>
                      <CopyId value={entry.actorId} label="actor UUID" />
                    </dd>
                  </div>
                  <div>
                    <dt>Target UUID</dt>
                    <dd>
                      {entry.targetId ? (
                        <CopyId value={entry.targetId} label="target UUID" />
                      ) : (
                        'Not recorded'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Source created timestamp</dt>
                    <dd className="break-all font-mono text-xs">
                      {entry.createdAt}
                    </dd>
                  </div>
                  <div>
                    <dt>Source completed timestamp</dt>
                    <dd className="break-all font-mono text-xs">
                      {entry.completedAt ?? 'Not reported'}
                    </dd>
                  </div>
                </dl>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
