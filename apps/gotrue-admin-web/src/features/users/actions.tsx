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
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { UserCreationProvider, useCreateUser } from './creation';
import { InvitationOutcome } from '@/features/email/views';
import { InvitationProvider } from '@/features/email/hooks';
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
import {
  Failure,
  Success,
  MutationFeedback,
  PendingMutation,
} from '@/components/feedback/states';
import { toast } from 'sonner';
import { failureMessage } from '@/lib/api/feedback';
import { Spinner } from '@/components/ui/spinner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

type Action =
  | 'ban'
  | 'unban'
  | 'delete'
  | 'send_verification'
  | 'resend_invitation';
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
  const location = useLocation();
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const focusUsers = useRef(false);
  const form = useForm({
    resolver: zodResolver(durationSchema),
    defaultValues: { durationHours: 24 },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new ApiFailure('INVALID_INPUT', 400, false);
      const current = target;
      const response = await runtime.protectedCall<{ auditId: string }>(() =>
        current.action === 'resend_invitation'
          ? operatorApi.resendInvitation(current.id)
          : current.action === 'send_verification'
            ? operatorApi.sendVerification(current.id)
            : current.action === 'ban'
              ? operatorApi.ban(current.id, form.getValues('durationHours'))
              : current.action === 'unban'
                ? operatorApi.unban(current.id)
                : operatorApi.delete(current.id),
      );
      return { auditId: response.auditId, target: current };
    },
    onSuccess: (response) => {
      if (runtime.generation() !== generation) return;
      setOpen(false);
      form.reset({ durationHours: 24 });
      toast.success(
        {
          ban: 'User banned',
          unban: 'User unbanned',
          delete: 'User deleted',
          send_verification: 'Verification requested',
          resend_invitation: 'Invitation requested',
        }[response.target.action],
      );
      void runtime.client.invalidateQueries({
        queryKey: ['private', generation],
      });
      if (response.target.action === 'delete') {
        focusUsers.current = true;
        navigate('/users', { replace: true });
      }
    },
    onError: (error) => {
      if (
        runtime.generation() === generation &&
        !(error instanceof ApiFailure && error.uncertain)
      )
        toast.error(failureMessage(error));
    },
  });
  const uncertain =
    mutation.error instanceof ApiFailure && mutation.error.uncertain;
  const { reset: resetMutation } = mutation;
  const { reset: resetForm } = form;
  useEffect(() => {
    setTarget(null);
    setOpen(false);
    busy.current = false;
    focusUsers.current = false;
    resetMutation();
    resetForm({ durationHours: 24 });
  }, [generation, resetMutation, resetForm]);
  useEffect(() => {
    setOpen(false);
    if (location.pathname !== '/users' || !focusUsers.current) return;
    focusUsers.current = false;
    const frame = requestAnimationFrame(() =>
      document.getElementById('main')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);
  const start = (user: SafeUser, action: Action, element: HTMLElement) => {
    if (busy.current || uncertain) return;
    mutation.reset();
    opener.current = element;
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
      /* Uncertain results remain persistent; definite failures have one toast. */
    } finally {
      if (runtime.generation() === generation) busy.current = false;
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
    if (!busy.current) {
      if (!value && !uncertain) {
        mutation.reset();
        form.reset({ durationHours: 24 });
      }
      setOpen(value);
    }
  };
  return {
    target,
    opener,
    open,
    start,
    changeOpen,
    afterOpenChange: (value: boolean) => {
      if (value || open) return;
      if (opener.current?.isConnected) opener.current.focus();
      else document.getElementById('main')?.focus();
    },
    submit,
    form,
    pending: mutation.isPending,
    uncertain,
    error: mutation.error,
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
  return (
    <InvitationProvider>
      <UserCreationProvider>
        <StatefulActions>{children}</StatefulActions>
      </UserCreationProvider>
    </InvitationProvider>
  );
}
function useActions() {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('User actions provider is missing.');
  return value;
}
export function ActionOutcome() {
  const m = useActions();
  const creation = useCreateUser();
  return (
    <div className="space-y-3 empty:hidden">
      <InvitationOutcome />
      {!creation.open && creation.pending && (
        <Success title="Account creation pending">
          The request is still in progress.{' '}
          <Link className="underline" to="/history">
            View history
          </Link>
        </Success>
      )}
      {!creation.open && creation.blocked && <Failure error={creation.error} />}
      {!m.open && m.pending && (
        <Success title="Management action pending">
          The request is still in progress.{' '}
          <Link className="underline" to="/history">
            View history
          </Link>
        </Success>
      )}
      {!m.open && m.uncertain && <Failure error={m.error} />}
    </div>
  );
}
export function UserActions({ user }: { user: SafeUser }) {
  const m = useActions();
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          <h2>Manage account</h2>
        </CardTitle>
        <CardDescription>
          Bans and deletion affect this identity across applications. They do
          not guarantee immediate revocation of every existing token.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
          <Button
            variant="outline"
            disabled={
              m.pending ||
              m.uncertain ||
              !user.email ||
              !!user.emailConfirmedAt ||
              user.isBanned !== false
            }
            onClick={(event) =>
              m.start(
                user,
                user.invitedAt ? 'resend_invitation' : 'send_verification',
                event.currentTarget,
              )
            }
          >
            {user.invitedAt ? 'Resend invitation' : 'Send verification email'}
          </Button>
          <Button
            variant="outline"
            disabled={m.pending || m.uncertain}
            onClick={(event) => m.start(user, 'ban', event.currentTarget)}
          >
            Ban user
          </Button>
          <Button
            variant="outline"
            disabled={m.pending || m.uncertain}
            onClick={(event) => m.start(user, 'unban', event.currentTarget)}
          >
            Unban user
          </Button>
          <Button
            variant="destructive"
            disabled={m.pending || m.uncertain}
            onClick={(event) => m.start(user, 'delete', event.currentTarget)}
          >
            Permanently delete user
          </Button>
        </div>
      </CardContent>
      <AlertDialog
        open={m.open}
        onOpenChange={m.changeOpen}
        onOpenChangeComplete={m.afterOpenChange}
      >
        <AlertDialogContent
          finalFocus={m.opener}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <form noValidate onSubmit={m.submit}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {m.target?.action === 'resend_invitation'
                  ? 'Resend invitation?'
                  : m.target?.action === 'send_verification'
                    ? 'Send verification email?'
                    : m.target?.action === 'delete'
                      ? 'Permanently delete global identity?'
                      : m.target?.action === 'ban'
                        ? 'Ban global identity?'
                        : 'Unban global identity?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {m.target?.action === 'resend_invitation'
                  ? 'The recipient uses the newest code to verify their email and choose a password. A request does not confirm inbox delivery.'
                  : m.target?.action === 'send_verification'
                    ? 'Sends a verification code to the current email address. A request does not confirm inbox delivery.'
                    : m.target?.action === 'delete'
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
              <MutationFeedback error={m.error} />
              {m.pending && <PendingMutation />}
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
                  : m.target?.action === 'resend_invitation'
                    ? 'Resend invitation'
                    : m.target?.action === 'send_verification'
                      ? 'Send verification email'
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
    </Card>
  );
}
