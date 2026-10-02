import { Link } from 'react-router-dom';
import { FieldGroup } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { TextField, PasswordField } from '@/components/form-fields';
import { Failure, Success, Submit } from '@/components/feedback/states';
import { useForgotPassword, useResetPassword } from './hooks';
import { AuthLayout } from '@/components/auth-layout';

export function ForgotPasswordPage() {
  const m = useForgotPassword();
  return (
    <AuthLayout
      title="Recover your password"
      navigation={
        <Link to="/login" className="block text-center text-sm underline">
          Return to sign in
        </Link>
      }
      description={<>Open the newest recovery email in this same browser.</>}
    >
      {m.success ? (
        <Success title="Check your email">
          If the account can be recovered, you’ll receive a link to reset your
          password. This acknowledgement does not confirm delivery.
        </Success>
      ) : (
        <form noValidate onSubmit={m.submit}>
          <FieldGroup>
            <TextField
              id="recovery-email"
              label="Email"
              description="Use the email for your operator account."
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
    </AuthLayout>
  );
}
export function ResetPasswordPage() {
  const m = useResetPassword();
  return (
    <AuthLayout
      title="Set a new password"
      navigation={
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/login" />}
          >
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
      }
      description={
        <>Open the newest recovery email in this browser before submitting.</>
      }
      footer="A submitted reset can invalidate dashboard sessions even if the password update fails. Recovery never grants operator access."
    >
      {m.success ? (
        <Success title="Sign in with your new password">
          Your dashboard sessions were cleared.
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
    </AuthLayout>
  );
}
