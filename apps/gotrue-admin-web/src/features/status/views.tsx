import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from '@/components/ui/item';
import { HealthBadge } from '@/components/health-badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Failure } from '@/components/feedback/states';
import { Timestamp } from '@/components/timestamp';
import { useStatusPage } from './hooks';

export function StatusPage() {
  const m = useStatusPage();
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Service status</h1>
        <ButtonGroup>
          <Button
            variant="outline"
            onClick={m.refreshAll}
            disabled={m.refreshing}
          >
            {m.refreshing && <Spinner />}Refresh all checks
          </Button>
        </ButtonGroup>
      </div>
      <p className="max-w-prose text-muted-foreground">
        Health checks are separate signals. They do not prove email delivery,
        sign-in or end-to-end persistence.
      </p>
      <div className="space-y-4">
        {m.checks.map((check) => (
          <section key={check.label} aria-label={check.label}>
            <Item variant="outline">
              <ItemContent>
                <ItemTitle>{check.label}</ItemTitle>
                <ItemDescription>{check.description}</ItemDescription>
                <div
                  role="status"
                  className="flex flex-wrap items-center gap-2"
                >
                  <HealthBadge status={check.status} />
                  {check.refreshing && (
                    <Spinner aria-label="Refreshing check" />
                  )}
                </div>
                {check.status === 'Checking…' ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  <p className="text-sm">
                    Last check:{' '}
                    <Timestamp
                      value={
                        check.checkedAt
                          ? new Date(check.checkedAt).toISOString()
                          : null
                      }
                    />
                  </p>
                )}
                {check.version && (
                  <p className="text-sm">GoTrue version: {check.version}</p>
                )}
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  disabled={check.refreshing}
                  onClick={check.refresh}
                  aria-label={`Refresh ${check.label}`}
                >
                  Refresh
                </Button>
              </ItemActions>
            </Item>
            {check.error && (
              <Failure error={check.error} retry={check.refresh} />
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
