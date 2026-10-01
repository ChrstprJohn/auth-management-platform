import { Link } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import type { SafeUser } from '@auth/contracts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { CopyId } from '@/components/copy-id';
import { Timestamp } from '@/components/timestamp';
import { PageControls } from '@/components/page-controls';
import { TextField, PasswordField } from '@/components/form-fields';
import {
  Blank,
  Failure,
  Loading,
  Submit,
  Success,
} from '@/components/feedback/states';
import { banStatus } from '@/lib/format/display';
import { useUsersPage, useUserDetails, useCreateUser } from './hooks';
import { UserActions } from './actions';

export function UserInformation({ user }: { user: SafeUser }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>UUID</ItemTitle>
          <CopyId value={user.id} label="user UUID" />
        </ItemContent>
      </Item>
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Email</ItemTitle>
          <ItemDescription className="break-all">
            {user.email ?? 'Not reported'}
          </ItemDescription>
        </ItemContent>
      </Item>
      <Item>
        <ItemContent>
          <ItemTitle>Email confirmation</ItemTitle>
          <ItemDescription>
            {user.emailConfirmedAt ? 'Confirmed' : 'No confirmation reported'} ·{' '}
            <Timestamp value={user.emailConfirmedAt} />
          </ItemDescription>
        </ItemContent>
      </Item>
      <Item>
        <ItemContent>
          <ItemTitle>Created</ItemTitle>
          <ItemDescription>
            <Timestamp value={user.createdAt} />
          </ItemDescription>
        </ItemContent>
      </Item>
      <Item>
        <ItemContent>
          <ItemTitle>Last sign in</ItemTitle>
          <ItemDescription>
            <Timestamp value={user.lastSignInAt} />
          </ItemDescription>
        </ItemContent>
      </Item>
      <Item>
        <ItemContent>
          <ItemTitle>Ban status</ItemTitle>
          <ItemDescription>
            <Badge variant="outline">{banStatus(user.isBanned)}</Badge> · Ban
            expiry: <Timestamp value={user.bannedUntil} />
          </ItemDescription>
        </ItemContent>
      </Item>
    </div>
  );
}
export function UsersPage() {
  const m = useUsersPage();
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Users</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={m.refreshing || m.state === 'loading'}
            onClick={m.refresh}
          >
            {m.refreshing ? 'Refreshing…' : 'Refresh users'}
          </Button>
          <Button nativeButton={false} render={<Link to="/users/new" />}>
            Create user
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground">
        Global accounts shared across applications. Pages can shift as accounts
        change.
      </p>
      {m.pagination.invalid && (
        <Success title="Pagination was normalized">
          Invalid page values use safe defaults.{' '}
          <Button variant="outline" onClick={m.pagination.normalize}>
            Update address
          </Button>
        </Success>
      )}
      {m.refreshing && <p role="status">Refreshing the current page…</p>}
      {m.error && <Failure error={m.error} retry={m.refresh} />}{' '}
      {m.state === 'loading' ? (
        <Loading label="Loading users" />
      ) : m.state === 'empty' ? (
        <Blank
          title="No users on this page"
          description="Choose an earlier page or create a permitted account."
          href="/users/new"
          action="Create user"
        />
      ) : (
        m.data && (
          <Table>
            <TableCaption>
              Safe account data on page {m.pagination.page}; no total count is
              provided.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Email / UUID</TableHead>
                <TableHead>Confirmation</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last sign in</TableHead>
                <TableHead>Ban status / expiry</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="max-w-80 whitespace-normal">
                    <p className="break-all">
                      {user.email ?? 'Email not reported'}
                    </p>
                    <CopyId value={user.id} label="user UUID" />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {user.emailConfirmedAt ? 'Confirmed' : 'Not reported'}
                    </Badge>
                    <div>
                      <Timestamp value={user.emailConfirmedAt} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Timestamp value={user.createdAt} />
                  </TableCell>
                  <TableCell>
                    <Timestamp value={user.lastSignInAt} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{banStatus(user.isBanned)}</Badge>
                    <div>
                      <Timestamp value={user.bannedUntil} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      className="underline"
                      to={`/users/${user.id}`}
                      aria-label={`View ${user.email ?? user.id}`}
                    >
                      View account
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      )}
      {m.state !== 'loading' && (
        <PageControls
          model={m.pagination}
          hasNext={m.data?.hasNextPage ?? false}
          pending={m.refreshing}
        />
      )}
    </section>
  );
}
export function UserDetailsPage() {
  const m = useUserDetails();
  if (m.state === 'missing')
    return (
      <Blank
        title="Account not found"
        description="The ID is invalid or the account is missing/already deleted. A missing account does not establish the outcome of an earlier uncertain action."
      />
    );
  return (
    <section className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/users" />}>Users</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Account details</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Account details</h1>
        <Button
          variant="outline"
          disabled={m.refreshing || m.state === 'loading'}
          onClick={m.refresh}
        >
          {m.refreshing ? 'Refreshing…' : 'Refresh account'}
        </Button>
      </div>
      {m.error && <Failure error={m.error} retry={m.refresh} />}{' '}
      {m.state === 'loading' ? (
        <Loading label="Loading account details" />
      ) : (
        m.user && (
          <>
            <UserInformation user={m.user} />
            <UserActions user={m.user} />
            <Separator />
            <p className="text-sm text-muted-foreground">
              Management actions affect this shared identity across
              applications.
            </p>
          </>
        )
      )}
    </section>
  );
}
export function CreateUserPage() {
  const m = useCreateUser();
  return (
    <section className="max-w-2xl space-y-6">
      <Link className="underline" to="/users">
        Return to users
      </Link>
      <h1>Create a global user</h1>
      <p className="text-muted-foreground">
        Both policies create an account without sending an invitation or
        confirmation email.
      </p>
      {m.result ? (
        <>
          <Success title="Account creation confirmed">
            Audit ID: <CopyId value={m.result.auditId} label="audit ID" />
          </Success>
          <UserInformation user={m.result.user} />
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              render={<Link to={`/users/${m.result.user.id}`} />}
            >
              Open account
            </Button>
            <Button variant="outline" onClick={m.newAccount}>
              Create another user
            </Button>
          </div>
        </>
      ) : (
        <form noValidate onSubmit={m.submit}>
          <FieldGroup>
            <TextField
              id="create-email"
              label="Email"
              type="email"
              autoComplete="off"
              registration={m.form.register('email')}
              error={m.form.formState.errors.email?.message}
              disabled={m.pending || m.blocked}
            />
            <PasswordField
              id="create-password"
              label="Password"
              registration={m.form.register('password')}
              error={m.form.formState.errors.password?.message}
              visible={m.visible}
              toggle={m.toggle}
              newPassword
              disabled={m.pending || m.blocked}
            />
            <Controller
              control={m.form.control}
              name="confirmation"
              render={({ field, fieldState }) => (
                <FieldSet>
                  <FieldLegend>Confirmation policy</FieldLegend>
                  <FieldDescription id="policy-help">
                    Make a deliberate choice. Operator confirmation bypasses
                    email ownership verification.
                  </FieldDescription>
                  <RadioGroup
                    name={field.name}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={m.pending || m.blocked}
                    aria-labelledby="policy-label"
                    aria-describedby="policy-help policy-error"
                  >
                    <span id="policy-label" className="sr-only">
                      Confirmation policy
                    </span>
                    <Field orientation="horizontal">
                      <RadioGroupItem
                        id="require-verification"
                        value="require_verification"
                        inputRef={field.ref}
                      />
                      <FieldLabel htmlFor="require-verification">
                        Require verification
                      </FieldLabel>
                    </Field>
                    <FieldDescription>
                      This account remains unconfirmed and cannot complete
                      normal verified login until a supported verification flow
                      is available. No email is sent.
                    </FieldDescription>
                    <Field orientation="horizontal">
                      <RadioGroupItem
                        id="operator-confirmed"
                        value="operator_confirmed"
                      />
                      <FieldLabel htmlFor="operator-confirmed">
                        Operator confirmed
                      </FieldLabel>
                    </Field>
                    <FieldDescription>
                      Explicitly bypass email ownership verification. No email
                      is sent.
                    </FieldDescription>
                  </RadioGroup>
                  {fieldState.error && (
                    <FieldError id="policy-error">
                      {fieldState.error.message}
                    </FieldError>
                  )}
                </FieldSet>
              )}
            />
            {m.error && <Failure error={m.error} />}
            <Submit
              pending={m.pending}
              disabled={m.blocked}
              label="Create user"
              progress="Creating user…"
            />
          </FieldGroup>
        </form>
      )}
    </section>
  );
}
