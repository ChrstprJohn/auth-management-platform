import { Link } from 'react-router-dom';
import { FieldGroup } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { PasswordField, TextField } from '@/components/form-fields';
import { CopyId } from '@/components/copy-id';
import { Failure, Submit } from '@/components/feedback/states';
import { date } from '@/lib/format/display';
import { useLogin, useAccount } from './hooks';

export function LoginPage() {
  const m = useLogin();
  return (
    <section className="public-form">
      <h1>Operator sign in</h1>
      <p className="text-muted-foreground">
        Manage the shared GoTrue identity pool.
      </p>
      <form noValidate onSubmit={m.submit}>
        <FieldGroup>
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            registration={m.form.register('email')}
            error={m.form.formState.errors.email?.message}
            disabled={m.pending}
          />
          <PasswordField
            id="password"
            label="Password"
            registration={m.form.register('password')}
            error={m.form.formState.errors.password?.message}
            visible={m.visible}
            toggle={m.toggle}
            disabled={m.pending}
          />
          {m.error && <Failure error={m.error} />}
          <Submit pending={m.pending} label="Sign in" progress="Signing in…" />
        </FieldGroup>
      </form>
      <Link className="underline" to="/forgot-password">
        Forgot password?
      </Link>
    </section>
  );
}
export function AccountPage() {
  const m = useAccount();
  return (
    <section className="space-y-6">
      <h1>Current account</h1>
      <p className="text-muted-foreground">
        This dashboard session does not refresh automatically. Sign in again
        after expiry.
      </p>
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Operator email</ItemTitle>
          <ItemDescription className="break-all">
            {m.session?.operator.email}
          </ItemDescription>
        </ItemContent>
      </Item>
      <Item>
        <ItemContent>
          <ItemTitle>Operator UUID</ItemTitle>
          <CopyId value={m.session?.operator.id ?? ''} label="operator UUID" />
        </ItemContent>
      </Item>
      <Separator />
      <Item>
        <ItemContent>
          <ItemTitle>Session expires</ItemTitle>
          <ItemDescription>{date(m.session?.expiresAt)}</ItemDescription>
        </ItemContent>
      </Item>
      {m.error && <Failure error={m.error} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={m.retry}>
          Recheck session
        </Button>
        <Button disabled={m.pending} onClick={m.logout}>
          {m.pending ? 'Signing out…' : 'Logout'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Logout affects this dashboard session only.
      </p>
    </section>
  );
}
