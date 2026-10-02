import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth-layout';
import { TextField, PasswordField } from '@/components/form-fields';
import { FieldGroup } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import {
  Failure,
  Submit,
  Success,
  MutationFeedback,
  PendingMutation,
} from '@/components/feedback/states';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ApiFailure } from '@/lib/api/client';
import {
  useEmailProof,
  useInviteUser,
  useInviteUserEntry,
  useLegacyInviteUserRoute,
  type EmailCallbackStatus,
} from './hooks';

export function InviteUserPage() {
  useLegacyInviteUserRoute();
  return null;
}
export function InviteUserDialog({
  model: m,
}: {
  model: ReturnType<typeof useInviteUserEntry>;
}) {
  return (
    <Dialog
      open={m.open}
      onOpenChange={m.changeOpen}
      onOpenChangeComplete={m.afterOpenChange}
    >
      <DialogContent
        finalFocus={m.opener}
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            The recipient verifies their email and chooses a password. This does
            not grant operator access.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={m.submit}>
          <FieldGroup>
            <TextField
              id="invite-email"
              label="Recipient email"
              type="email"
              autoComplete="email"
              registration={m.form.register('email')}
              error={m.form.formState.errors.email?.message}
              disabled={m.pending || m.blocked}
            />
            <p className="text-sm text-muted-foreground">
              Creates or reinvites an unconfirmed account. Confirmed accounts
              are rejected. A requested invitation does not confirm inbox
              delivery.
            </p>
            <MutationFeedback error={m.error} />
            {m.pending && <PendingMutation />}
            <DialogFooter>
              <DialogClose
                disabled={m.pending}
                render={<Button variant="outline" />}
              >
                {m.blocked ? 'Close' : 'Cancel'}
              </DialogClose>
              <Submit
                label="Send invitation"
                progress="Requesting invitation…"
                pending={m.pending}
                disabled={m.blocked}
              />
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function InvitationOutcome() {
  const m = useInviteUser();
  return (
    <>
      {!m.open && m.pending && (
        <Success title="Invitation pending">
          The request is still in progress.{' '}
          <Link className="underline" to="/history">
            View history
          </Link>
        </Success>
      )}
      {!m.open && m.blocked && <Failure error={m.error} />}
    </>
  );
}
export function EmailProofPage({
  invitation = false,
}: {
  invitation?: boolean;
}) {
  const m = useEmailProof(invitation);
  return (
    <AuthLayout
      title={invitation ? 'Accept your invitation' : 'Confirm your email'}
      description={
        invitation
          ? 'Use your newest invitation code and choose a password.'
          : 'Enter your email and the code from your newest confirmation email.'
      }
      navigation={
        <Link
          className="text-center text-sm underline underline-offset-4"
          to="/login"
        >
          Go to operator sign in
        </Link>
      }
    >
      {m.success ? (
        <Success
          title={
            invitation ? 'Email verified and password set' : 'Email verified'
          }
        >
          Sign in normally in your application. Dashboard access requires a
          separately configured operator identity.
        </Success>
      ) : (
        <form noValidate onSubmit={m.submit}>
          <FieldGroup>
            <TextField
              id="proof-email"
              label="Email"
              type="email"
              autoComplete="email"
              registration={m.form.register('email')}
              error={m.form.formState.errors.email?.message}
              disabled={m.pending || m.blocked}
            />
            <TextField
              id="email-code"
              label="Email code"
              autoComplete="one-time-code"
              registration={m.form.register('code')}
              error={m.form.formState.errors.code?.message}
              disabled={m.pending || m.blocked}
              description="Never share this code."
            />
            {invitation && (
              <>
                <PasswordField
                  id="invitation-password"
                  label="New password"
                  newPassword
                  registration={m.form.register('password')}
                  error={m.form.formState.errors.password?.message}
                  visible={m.visible}
                  toggle={m.toggle}
                  disabled={m.pending || m.blocked}
                />
                <PasswordField
                  id="invitation-confirmation"
                  label="Confirm new password"
                  newPassword
                  registration={m.form.register('confirmation')}
                  error={m.form.formState.errors.confirmation?.message}
                  visible={m.visible}
                  toggle={m.toggle}
                  disabled={m.pending || m.blocked}
                />
              </>
            )}
            {m.error && (
              <>
                <Failure error={m.error} inspection={false} />
                <p className="text-sm">
                  A submitted code may already be consumed. For password setup
                  failures, try normal sign-in or contact the inviting operator.
                </p>
                {m.error instanceof ApiFailure &&
                  [
                    'INVALID_EMAIL_CODE',
                    'EMAIL_RATE_LIMITED',
                    'RATE_LIMITED',
                  ].includes(m.error.code) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={m.freshCode}
                    >
                      {m.error.code === 'INVALID_EMAIL_CODE'
                        ? 'Use the newest email code'
                        : 'Enter a code after waiting'}
                    </Button>
                  )}
              </>
            )}
            <Submit
              label={
                invitation ? 'Verify email and set password' : 'Verify email'
              }
              progress="Verifying…"
              pending={m.pending}
              disabled={m.blocked}
            />
          </FieldGroup>
        </form>
      )}
    </AuthLayout>
  );
}
export function EmailCallbackPage({ status }: { status: EmailCallbackStatus }) {
  return (
    <AuthLayout
      title="Email link result"
      description={
        status === 'invalid'
          ? 'This email link is invalid or expired. Use the newest email.'
          : status === 'processed'
            ? 'The email link was processed. Sign in to check your account.'
            : 'No email result is available. Use the newest email or complete verification with its code.'
      }
      navigation={
        <Link
          className="text-center text-sm underline underline-offset-4"
          to="/login"
        >
          Go to sign in
        </Link>
      }
    >
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link to="/confirm-email" />}
      >
        Confirm with an email code
      </Button>
    </AuthLayout>
  );
}
