import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth-layout';
import { PageHeader } from '@/components/page-header';
import { TextField, PasswordField } from '@/components/form-fields';
import { FieldGroup } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Failure, Submit, Success } from '@/components/feedback/states';
import { CopyId } from '@/components/copy-id';
import { ApiFailure } from '@/lib/api/client';
import {
  useEmailProof,
  useInviteUser,
  type EmailCallbackStatus,
} from './hooks';

export function InviteUserPage() {
  const m = useInviteUser();
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Invite a user"
        description="Send an invitation to the shared identity pool. The recipient verifies their email and chooses their own password. This does not grant operator access."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/users" />}
          >
            Return to users
          </Button>
        }
      />
      <Card className="max-w-xl">
        <CardContent>
          {m.result ? (
            <div className="space-y-4">
              <Success title="Invitation request accepted">
                Check the recipient inbox to confirm delivery. Account:{' '}
                <CopyId value={m.result.user.id} label="user UUID" /> · Audit:{' '}
                <CopyId value={m.result.auditId} label="audit ID" />
              </Success>
              <Button onClick={m.another}>Invite another user</Button>
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link to={`/users/${m.result.user.id}`} />}
              >
                Inspect account
              </Button>
            </div>
          ) : (
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
                  This sends email and may create a new account. An existing
                  unconfirmed account can receive a new invitation; confirmed
                  accounts are rejected. Delivery is not guaranteed by
                  acceptance.
                </p>
                {m.error && <Failure error={m.error} />}
                {m.pending && (
                  <p role="status">
                    Sending the invitation request. Navigating away does not
                    cancel it.
                  </p>
                )}
                <Submit
                  label="Send invitation"
                  progress="Requesting invitation…"
                  pending={m.pending}
                  disabled={m.blocked}
                />
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
export function InvitationOutcome() {
  const m = useInviteUser();
  return (
    <>
      {m.pending && (
        <Success title="Invitation pending">
          Navigating away does not cancel the email request.
        </Success>
      )}
      {m.error && <Failure error={m.error} />}
      {m.result && (
        <Success title="Invitation request accepted">
          Inbox delivery still needs confirmation. Audit:{' '}
          <CopyId value={m.result.auditId} label="audit ID" />
        </Success>
      )}
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
          ? 'Use the code from your newest invitation and choose a password. Invitation acceptance does not grant operator access.'
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
              description="Use only the newest code. Never share it."
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
            ? 'The email link was processed. Sign in normally to check your account. Link credentials have been removed.'
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
