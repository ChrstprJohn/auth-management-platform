import type { AuditEntry } from '@auth/contracts';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyId } from '@/components/copy-id';
import { Timestamp } from '@/components/timestamp';
import { MoreHorizontal, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export function ActionDetails({ entry }: { entry: AuditEntry }) {
  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label={`Actions for action ${entry.id}`}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem nativeButton render={<DialogTrigger />}>
            <Eye />
            View details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent
        initialFocus={false}
        className="max-h-[85svh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Action details</DialogTitle>
          <DialogDescription>
            Read-only durable record. Pending and unknown results require
            administrator reconciliation.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4 [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground">
          <div>
            <dt>Action</dt>
            <dd className="capitalize font-medium">{entry.action}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>
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
                <>
                  <CopyId value={entry.targetId} label="target UUID" />
                  <Link
                    className="mt-1 block text-sm underline"
                    to={`/users/${entry.targetId}`}
                  >
                    Inspect target
                  </Link>
                </>
              ) : (
                'Not known'
              )}
            </dd>
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
        </dl>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
