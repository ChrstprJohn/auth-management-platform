import { Link } from 'react-router-dom';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiFailure } from '@/lib/api/client';
import { failureMessage } from '@/lib/api/feedback';

export function Failure({
  error,
  retry,
  inspection = true,
}: {
  error: unknown;
  retry?: () => void;
  inspection?: boolean;
}) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>Request needs attention</AlertTitle>
      <AlertDescription>
        <p>{failureMessage(error)}</p>
        {error instanceof ApiFailure && (
          <>
            {error.outcome && <p>Known upstream outcome: {error.outcome}</p>}
            {error.uncertain && inspection && (
              <p>
                <Link
                  className="underline"
                  to={error.auditId ? `/history/${error.auditId}` : '/history'}
                >
                  View history
                </Link>
              </p>
            )}
            {(error.requestId || error.auditId) && (
              <details className="min-w-0">
                <summary className="cursor-pointer underline underline-offset-4">
                  Technical details
                </summary>
                {error.requestId && (
                  <p className="break-all">Request ID: {error.requestId}</p>
                )}
                {error.auditId && (
                  <p className="break-all">Audit ID: {error.auditId}</p>
                )}
              </details>
            )}
          </>
        )}
        {retry && (
          <Button variant="outline" onClick={retry}>
            Retry read
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
export function Loading({
  label = 'Loading account data',
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
export function MutationFeedback({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof ApiFailure && error.uncertain)
    return <Failure error={error} />;
  return (
    <details className="min-w-0 text-sm">
      <summary className="cursor-pointer underline underline-offset-4">
        Technical details
      </summary>
      <p className="mt-2">{failureMessage(error)}</p>
      {error instanceof ApiFailure && (
        <>
          {error.requestId && (
            <p className="break-all">Request ID: {error.requestId}</p>
          )}
          {error.auditId && (
            <p className="break-all">Audit ID: {error.auditId}</p>
          )}
        </>
      )}
    </details>
  );
}
export function PendingMutation() {
  return (
    <p role="status" className="text-sm">
      The request is still in progress.{' '}
      <Link className="underline" to="/history">
        View history
      </Link>
    </p>
  );
}
export function Blank({
  title,
  description,
  href = '/users',
  action = 'Return to users',
  actionElement,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
  actionElement?: React.ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle role="heading" aria-level={2}>
          {title}
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {actionElement ?? (
          <Button nativeButton={false} render={<Link to={href} />}>
            {action}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
}
export function Success({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Alert role="status">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
export function Submit({
  pending,
  disabled,
  label,
  progress,
}: {
  pending: boolean;
  disabled?: boolean;
  label: string;
  progress: string;
}) {
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending && <Spinner />}
      {pending ? progress : label}
    </Button>
  );
}
