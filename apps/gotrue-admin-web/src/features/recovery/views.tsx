import { Link } from 'react-router-dom';
import { FieldGroup } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { TextField, PasswordField } from '@/components/form-fields';
import { Failure, Success, Submit } from '@/components/feedback/states';
import { useForgotPassword, useResetPassword } from './hooks';

export function ForgotPasswordPage() {
  const m = useForgotPassword();
  return (
    <section className="public-form">
      <h1>Recover your password</h1>
      <p className="text-muted-foreground">
        Request recovery here, then open the newest email in this same browser.
        Older emails and another browser cannot complete this flow.
      </p>
      {m.localMail && (
        <p className="text-sm">
          For local development, check{' '}
          <a
            className="underline"
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
          >
            Mailpit
          </a>{' '}
          in this browser.
        </p>
      )}
      {m.success ? (
        <Success title="Recovery requested">
          If the account can be recovered, a recovery email will be sent. This
          acknowledgement does not confirm delivery. Follow the newest email
          link; the backend will send you to the reset page.
        </Success>
      ) : (
        <form noValidate onSubmit={m.submit}>
          <FieldGroup>
            <TextField
              id="recovery-email"
              label="Email"
              type="email"
              autoComplete="email"
              registration={m.form.register('email')}
              error={m.form.formState.errors.email?.message}
              disabled={m.pending}
            />
            {m.error && <Failure error={m.error} />}
            <Submit
              pending={m.pending}
              label="Request recovery email"
              progress="Requesting recovery…"
            />
          </FieldGroup>
        </form>
      )}
      <Link to="/login" className="underline">
        Return to sign in
      </Link>
    </section>
  );
}
export function ResetPasswordPage() {
  const m = useResetPassword();
  return (
    <section className="public-form">
      <h1>Set a new password</h1>
      <p className="text-muted-foreground">
        Continue after opening your newest recovery email in this browser.
        Submitting this form checks the recovery context; opening this page
        alone does not verify it.
      </p>
      {m.success ? (
        <Success title="Password reset confirmed">
          Your dashboard sessions were cleared. Sign in normally with your new
          password.
        </Success>
      ) : (
        <form noValidate onSubmit={m.submit}>
          <FieldGroup>
            <PasswordField
              id="new-password"
              label="New password"
              registration={m.form.register('password')}
              error={m.form.formState.errors.password?.message}
              visible={m.visible}
              toggle={m.toggle}
              newPassword
              disabled={m.pending || m.blocked}
            />
            <PasswordField
              id="confirm-password"
              label="Confirm password"
              registration={m.form.register('confirmation')}
              error={m.form.formState.errors.confirmation?.message}
              visible={m.visible}
              toggle={m.toggle}
              newPassword
              disabled={m.pending || m.blocked}
            />
            {m.error && <Failure error={m.error} />}
            <Submit
              pending={m.pending}
              disabled={m.blocked}
              label="Reset password"
              progress="Resetting password…"
            />
          </FieldGroup>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link to="/login" />}>
          Return to sign in
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link to="/forgot-password" />}
        >
          Request a fresh recovery email
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        A submitted reset can invalidate dashboard sessions even if the password
        update fails. Recovery never grants operator access.
      </p>
    </section>
  );
}
