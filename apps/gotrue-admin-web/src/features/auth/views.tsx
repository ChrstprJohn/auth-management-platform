import { Link } from 'react-router-dom';
import { FieldGroup } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from '@/components/ui/item';
import { PageHeader } from '@/components/page-header';
import { PasswordField, TextField } from '@/components/form-fields';
import { CopyId } from '@/components/copy-id';
import {
  Failure,
  Submit,
  MutationFeedback,
} from '@/components/feedback/states';
import { Timestamp } from '@/components/timestamp';
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
      navigation={
        <Link
          className="block text-center text-sm underline underline-offset-4"
          to="/forgot-password"
        >
          Forgot password?
        </Link>
      }
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
    </AuthLayout>
  );
}
export function AccountPage() {
  const m = useAccount();
  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title="Current account"
        description="Sign in again when this session expires."
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-7">
        <Card className="min-w-0 lg:col-span-4">
          <CardHeader className="border-b">
            <CardTitle>
              <h2>Operator session</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Item className="px-0">
              <ItemContent className="min-w-0">
                <ItemTitle>Operator email</ItemTitle>
                <ItemDescription className="break-all">
                  {m.session?.operator.email}
                </ItemDescription>
              </ItemContent>
            </Item>
            <Item className="px-0">
              <ItemContent className="min-w-0">
                <ItemTitle>Operator UUID</ItemTitle>
                <CopyId
                  value={m.session?.operator.id ?? ''}
                  label="operator UUID"
                />
              </ItemContent>
            </Item>
            <MutationFeedback error={m.error} />
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={m.retry}>
                Recheck session
              </Button>
              <Button disabled={m.pending || m.uncertain} onClick={m.logout}>
                {m.pending ? 'Signing out…' : 'Logout'}
              </Button>
            </div>
          </CardFooter>
        </Card>
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader>
            <CardTitle>
              <h2>Session expiry</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {' '}
            <Item className="px-0">
              <ItemContent className="min-w-0">
                <ItemTitle>Session expires</ItemTitle>
                <ItemDescription>
                  <Timestamp value={m.session?.expiresAt} />
                </ItemDescription>
              </ItemContent>
            </Item>
            <p className="text-sm text-muted-foreground">
              Logout affects this dashboard session only.
            </p>
            <details className="min-w-0 text-sm">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-2 break-all font-mono text-xs">
                Source expiry timestamp:{' '}
                {m.session?.expiresAt ?? 'Not reported'}
              </p>
            </details>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
