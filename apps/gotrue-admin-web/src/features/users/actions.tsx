import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import type { SafeUser } from '@auth/contracts';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form-fields';
import { Failure, Success } from '@/components/feedback/states';
import { CopyId } from '@/components/copy-id';
import { Spinner } from '@/components/ui/spinner';

type Action = 'ban' | 'unban' | 'delete';
type Target = { id: string; email: string | null; action: Action };
export const durationSchema = z.object({
  durationHours: z
    .number()
    .int('Use whole hours.')
    .min(1, 'Use at least 1 hour.')
    .max(8760, 'Use at most 8760 hours.'),
});
function useActionController() {
  const { runtime, generation } = useSession();
  const navigate = useNavigate();
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    auditId: string;
    target: Target;
  } | null>(null);
  const busy = useRef(false);
  const form = useForm({
    resolver: zodResolver(durationSchema),
    defaultValues: { durationHours: 24 },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new ApiFailure('INVALID_INPUT', 400, false);
      const current = target;
      const response = await runtime.protectedCall<{ auditId: string }>(() =>
        current.action === 'ban'
          ? operatorApi.ban(current.id, form.getValues('durationHours'))
          : current.action === 'unban'
            ? operatorApi.unban(current.id)
            : operatorApi.delete(current.id),
      );
      return { auditId: response.auditId, target: current };
    },
    onSuccess: (response) => {
      setResult(response);
      setOpen(false);
      void runtime.client.invalidateQueries({
        queryKey: ['private', generation],
      });
      if (response.target.action === 'delete')
        navigate('/users', { replace: true });
    },
  });
  const uncertain =
    mutation.error instanceof ApiFailure && mutation.error.uncertain;
  const { reset: resetMutation } = mutation;
  const { reset: resetForm } = form;
  useEffect(() => {
    setTarget(null);
    setOpen(false);
    setResult(null);
    busy.current = false;
    resetMutation();
    resetForm({ durationHours: 24 });
  }, [generation, resetMutation, resetForm]);
  const start = (user: SafeUser, action: Action) => {
    if (busy.current || uncertain) return;
    mutation.reset();
    setResult(null);
    form.reset({ durationHours: 24 });
    setTarget({ id: user.id, email: user.email, action });
    setOpen(true);
  };
  const execute = async () => {
    if (busy.current || uncertain || !target) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Persistent outcome is rendered. */
    } finally {
      busy.current = false;
    }
  };
  const submit =
    target?.action === 'ban'
      ? form.handleSubmit(execute)
      : (event: React.FormEvent) => {
          event.preventDefault();
          void execute();
        };
  const changeOpen = (value: boolean) => {
    if (!busy.current) setOpen(value);
  };
  return {
    target,
    open,
    start,
    changeOpen,
    submit,
    form,
    pending: mutation.isPending,
    uncertain,
    error: mutation.error,
    result,
    dismiss: () => {
      if (!uncertain && !busy.current) {
        mutation.reset();
        setResult(null);
      }
    },
  };
}
const ActionsContext = createContext<ReturnType<
  typeof useActionController
> | null>(null);
function StatefulActions({ children }: { children: ReactNode }) {
  const model = useActionController();
  return (
    <ActionsContext.Provider value={model}>{children}</ActionsContext.Provider>
  );
}
export function UserActionsProvider({ children }: { children: ReactNode }) {
  return <StatefulActions>{children}</StatefulActions>;
}
function useActions() {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('User actions provider is missing.');
  return value;
}
export function ActionOutcome() {
  const m = useActions();
  return (
    <div className="mb-6 space-y-3">
      {m.pending && (
        <Success title="Management action pending">
          The backend may still be applying {m.target?.action}. Navigating away
          does not cancel it.
        </Success>
      )}
      {m.error && <Failure error={m.error} />}{' '}
      {m.result && (
        <Success
          title={`${m.result.target.action === 'delete' ? 'Permanent deletion' : m.result.target.action === 'ban' ? 'Ban' : 'Unban'} confirmed`}
        >
          Target: <CopyId value={m.result.target.id} label="target UUID" /> ·
          Audit: <CopyId value={m.result.auditId} label="audit ID" />
          <Button variant="ghost" onClick={m.dismiss}>
            Dismiss result
          </Button>
        </Success>
      )}
    </div>
  );
}
export function UserActions({ user }: { user: SafeUser }) {
  const m = useActions();
  return (
    <div className="space-y-4">
      <h2>Global management actions</h2>
      <p className="text-sm text-muted-foreground">
        Bans and deletion affect this identity across applications. They do not
        guarantee immediate revocation of every existing token.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={m.pending || m.uncertain}
          onClick={() => m.start(user, 'ban')}
        >
          Ban user
        </Button>
        <Button
          variant="outline"
          disabled={m.pending || m.uncertain}
          onClick={() => m.start(user, 'unban')}
        >
          Unban user
        </Button>
        <Button
          variant="destructive"
          disabled={m.pending || m.uncertain}
          onClick={() => m.start(user, 'delete')}
        >
          Permanently delete user
        </Button>
      </div>
      <AlertDialog open={m.open} onOpenChange={m.changeOpen}>
        <AlertDialogContent>
          <form noValidate onSubmit={m.submit}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {m.target?.action === 'delete'
                  ? 'Permanently delete global identity?'
                  : m.target?.action === 'ban'
                    ? 'Ban global identity?'
                    : 'Unban global identity?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {m.target?.action === 'delete'
                  ? 'This permanently removes the shared GoTrue identity across all applications. Application references are not automatically reconciled.'
                  : m.target?.action === 'ban'
                    ? 'This blocks access through the shared identity for the chosen duration.'
                    : 'This explicitly restores access by clearing the shared identity ban.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-5 space-y-4">
              <p className="break-all font-medium">
                {m.target?.email ?? 'Email not reported'}
              </p>
              <p className="break-all font-mono text-xs">{m.target?.id}</p>
              {m.target?.action === 'ban' && (
                <TextField
                  id="ban-duration"
                  label="Ban duration (hours)"
                  type="number"
                  registration={m.form.register('durationHours', {
                    valueAsNumber: true,
                  })}
                  error={m.form.formState.errors.durationHours?.message}
                  description="Whole hours from 1 to 8760."
                  disabled={m.pending}
                />
              )}{' '}
              {m.error && <Failure error={m.error} />}{' '}
              {m.pending && (
                <p role="status">
                  Applying the action. Closing or navigating cannot undo it.
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={m.pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                variant={
                  m.target?.action === 'delete' ? 'destructive' : 'default'
                }
                disabled={m.pending || m.uncertain}
              >
                {m.pending && <Spinner />}
                {m.pending
                  ? 'Applying…'
                  : m.target?.action === 'delete'
                    ? 'Confirm permanent deletion'
                    : m.target?.action === 'ban'
                      ? 'Confirm ban'
                      : 'Confirm unban'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
