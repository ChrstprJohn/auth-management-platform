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
import { AuthLayout } from '@/components/auth-layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

export function LoginPage() {
  const m = useLogin();
  return (
    <AuthLayout
      title="Operator sign in"
      description="Manage the shared GoTrue identity pool."
    >
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
      <Link
        className="block text-center text-sm underline underline-offset-4"
        to="/forgot-password"
      >
        Forgot password?
      </Link>
    </AuthLayout>
  );
}
export function AccountPage() {
  const m = useAccount();
  return (
    <section className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1>Current account</h1>
        <p className="text-muted-foreground">
          This dashboard session does not refresh automatically. Sign in again
          after expiry.
        </p>
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>
            <h2>Operator session</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Item className="px-0">
            <ItemContent>
              <ItemTitle>Operator email</ItemTitle>
              <ItemDescription className="break-all">
                {m.session?.operator.email}
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item className="px-0">
            <ItemContent>
              <ItemTitle>Operator UUID</ItemTitle>
              <CopyId
                value={m.session?.operator.id ?? ''}
                label="operator UUID"
              />
            </ItemContent>
          </Item>
          <Separator />
          <Item className="px-0">
            <ItemContent>
              <ItemTitle>Session expires</ItemTitle>
              <ItemDescription>{date(m.session?.expiresAt)}</ItemDescription>
            </ItemContent>
          </Item>
          {m.error && <Failure error={m.error} />}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-4">
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
        </CardFooter>
      </Card>
    </section>
  );
}
