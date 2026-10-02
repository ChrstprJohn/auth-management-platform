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
import { useUsersPage, useUserDetails } from './hooks';
import { useCreateUserEntry, useLegacyCreateUserRoute } from './creation';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { UserActions } from './actions';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Plus, RefreshCw } from 'lucide-react';
import { UserRowActions } from './row-actions';

export function UserInformation({ user }: { user: SafeUser }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          <h2>Account information</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-x-6 gap-y-2 xl:grid-cols-2">
        <Item className="px-0">
          <ItemContent className="min-w-0">
            <ItemTitle>UUID</ItemTitle>
            <CopyId value={user.id} label="user UUID" />
          </ItemContent>
        </Item>
        <Item className="px-0">
          <ItemContent className="min-w-0">
            <ItemTitle>Email</ItemTitle>
            <ItemDescription className="break-all">
              {user.email ?? 'Not reported'}
            </ItemDescription>
          </ItemContent>
        </Item>
        <Item className="px-0">
          <ItemContent className="min-w-0">
            <ItemTitle>Email confirmation</ItemTitle>
            <ItemDescription>
              {user.emailConfirmedAt ? (
                <Timestamp value={user.emailConfirmedAt} />
              ) : (
                'No confirmation reported'
              )}
            </ItemDescription>
          </ItemContent>
        </Item>
        <Item className="px-0">
          <ItemContent className="min-w-0">
            <ItemTitle>Created</ItemTitle>
            <ItemDescription>
              <Timestamp value={user.createdAt} />
            </ItemDescription>
          </ItemContent>
        </Item>
        <Item className="px-0">
          <ItemContent className="min-w-0">
            <ItemTitle>Last sign in</ItemTitle>
            <ItemDescription>
              <Timestamp value={user.lastSignInAt} />
            </ItemDescription>
          </ItemContent>
        </Item>
        <Item className="px-0">
          <ItemContent className="min-w-0">
            <ItemTitle>Ban status</ItemTitle>
            <ItemDescription>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{banStatus(user.isBanned)}</Badge>
              </span>
              <span className="mt-2 block">
                Ban expiry: <Timestamp value={user.bannedUntil} />
              </span>
            </ItemDescription>
          </ItemContent>
        </Item>
      </CardContent>
    </Card>
  );
}
export function UsersPage() {
  const m = useUsersPage();
  const creation = useCreateUserEntry();
  return (
    <Dialog open={creation.open} onOpenChange={creation.changeOpen}>
      <section className="space-y-6">
        <PageHeader
          title="Users"
          description="Global accounts shared across applications. Pages can shift as accounts change."
          actions={
            <>
              <Button
                variant="outline"
                disabled={m.refreshing || m.state === 'loading'}
                onClick={m.refresh}
              >
                <RefreshCw className={m.refreshing ? 'animate-spin' : ''} />
                {m.refreshing ? 'Refreshing…' : 'Refresh users'}
              </Button>
              <DialogTrigger
                ref={creation.triggerRef}
                onClick={creation.start}
                render={<Button />}
              >
                <Plus />
                Create user
              </DialogTrigger>
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link to="/users/invite" />}
              >
                Invite user
              </Button>
            </>
          }
        />
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
            actionElement={
              <DialogTrigger onClick={creation.start} render={<Button />}>
                Create user
              </DialogTrigger>
            }
            action="Create user"
          />
        ) : (
          m.data && (
            <Card className="gap-0 py-0">
              <CardContent className="p-0">
                <Table className="table-fixed">
                  <TableCaption>
                    Page {m.pagination.page}. Open an account for full details.
                  </TableCaption>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="lg:w-[32%]">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Confirmation
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Ban status
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Created
                      </TableHead>
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.data.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="whitespace-normal">
                          <p
                            className="truncate font-medium"
                            title={user.email ?? undefined}
                          >
                            {user.email ?? 'Email not reported'}
                          </p>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell">
                          <Badge
                            variant={
                              user.emailConfirmedAt ? 'secondary' : 'outline'
                            }
                          >
                            {user.emailConfirmedAt
                              ? 'Confirmed'
                              : 'Not reported'}
                          </Badge>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell">
                          <Badge
                            variant={
                              user.isBanned === true
                                ? 'destructive'
                                : user.isBanned === false
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {banStatus(user.isBanned)}
                          </Badge>
                        </TableCell>

                        <TableCell className="hidden whitespace-normal lg:table-cell">
                          <Timestamp value={user.createdAt} compact />
                        </TableCell>
                        <TableCell className="text-right">
                          <UserRowActions user={user} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
      <CreateUserDialog model={creation} />
    </Dialog>
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
      <PageHeader
        title="Account details"
        actions={
          <Button
            variant="outline"
            disabled={m.refreshing || m.state === 'loading'}
            onClick={m.refresh}
          >
            <RefreshCw className={m.refreshing ? 'animate-spin' : ''} />
            {m.refreshing ? 'Refreshing…' : 'Refresh account'}
          </Button>
        }
      />
      {m.error && <Failure error={m.error} retry={m.refresh} />}{' '}
      {m.state === 'loading' ? (
        <Loading label="Loading account details" />
      ) : (
        m.user && (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-7">
            <div className="min-w-0 lg:col-span-4">
              <UserInformation user={m.user} />
            </div>
            <div className="min-w-0 lg:col-span-3">
              <UserActions user={m.user} />
            </div>
          </div>
        )
      )}
    </section>
  );
}
export function LegacyCreateUserRoute() {
  useLegacyCreateUserRoute();
  return null;
}
function CreateUserDialog({
  model: m,
}: {
  model: ReturnType<typeof useCreateUserEntry>;
}) {
  return (
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
      finalFocus={m.opener}
      showCloseButton={false}
    >
      <DialogHeader>
        <DialogTitle>Create a global user</DialogTitle>
        <DialogDescription>
          Global accounts are shared across applications. Both policies create
          an account without sending an invitation or confirmation email.
        </DialogDescription>
      </DialogHeader>
      {m.result ? (
        <div className="min-w-0 space-y-4">
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
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </div>
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
                    Operator confirmation bypasses email ownership verification.
                  </FieldDescription>
                  <RadioGroup
                    className="gap-4"
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
                      normal verified login until email verification succeeds.
                      Creation sends no email; send verification separately from
                      account details.
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
            {m.pending && (
              <p role="status">
                Creating the account. Wait for the result before closing.
                Navigating away does not cancel or undo this request.
              </p>
            )}
            <DialogFooter>
              <DialogClose
                disabled={m.pending}
                render={<Button variant="outline" />}
              >
                {m.blocked ? 'Close' : 'Cancel'}
              </DialogClose>
              <Submit
                pending={m.pending}
                disabled={m.blocked}
                label="Create user"
                progress="Creating user…"
              />
            </DialogFooter>
          </FieldGroup>
        </form>
      )}
    </DialogContent>
  );
}
