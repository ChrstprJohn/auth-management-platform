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
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>Request needs attention</AlertTitle>
      <AlertDescription>
        <p>{failureMessage(error)}</p>
        {error instanceof ApiFailure && (
          <>
            {error.requestId && (
              <p className="break-all">Request ID: {error.requestId}</p>
            )}
            {error.auditId && (
              <p className="break-all">Audit ID: {error.auditId}</p>
            )}
            {error.outcome && <p>Known upstream outcome: {error.outcome}</p>}
            {error.uncertain && (
              <p>
                <Link className="underline" to="/history">
                  Inspect action history
                </Link>
              </p>
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
export function Blank({
  title,
  description,
  href = '/users',
  action = 'Return to users',
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
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
        <Button nativeButton={false} render={<Link to={href} />}>
          {action}
        </Button>
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
