import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAction } from '@/hooks/use-action'
import { useCallback, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ResourceState } from '@/components/common/resource-state'
import { Pagination } from '@/components/common/pagination'
import { useResource } from '@/hooks/use-resource'
import { Link } from 'react-router-dom'
import { adminApi } from '@/services/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export function OperatorsPage() {
  const [page, setPage] = useState(1)
  const load = useCallback(() => adminApi.operators(page), [page])
  const resource = useResource(load)
  const [userId, setUserId] = useState(''),
    [confirmation, setConfirmation] = useState('')
  const { busy, error, perform } = useAction()
  async function run(id: string, method: 'PUT' | 'DELETE') {
    await perform(
      () => (method === 'PUT' ? adminApi.grantOperator(id) : adminApi.revokeOperator(id)),
      () => {
        setUserId('')
        setConfirmation('')
        resource.reload()
      }
    )
  }
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <h1 className="text-2xl font-semibold">Dashboard operators</h1>
        <p className="text-muted-foreground">
          Grant global dashboard access to verified GoTrue accounts. This permission does not make
          them GoTrue operators.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Grant access</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Grant dashboard access</DialogTitle>
              <DialogDescription>
                This grants global administration access to an existing account.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void run(userId.trim(), 'PUT')
              }}
              className="space-y-4"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="operator-id">GoTrue user UUID</Label>
                <Input
                  id="operator-id"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <Button disabled={busy}>Grant dashboard access</Button>
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
            </form>
          </DialogContent>
        </Dialog>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <ResourceState {...resource} retry={resource.reload} />
        <Table aria-label="Dashboard operators">
          <TableHeader>
            <TableRow>
              <TableHead>Operator UUID</TableHead>
              <TableHead>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resource.data?.data.map((operator) => (
              <TableRow key={operator.gotrueUserId}>
                <TableCell>
                  <Link
                    className="break-all text-primary underline"
                    to={'/users/' + operator.gotrueUserId}
                  >
                    {operator.gotrueUserId}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Revoke access</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Revoke dashboard access</DialogTitle>
                        <DialogDescription>
                          Type this operator's UUID to confirm. The last administrator cannot be
                          removed.
                        </DialogDescription>
                      </DialogHeader>
                      <p className="break-all font-mono text-xs">{operator.gotrueUserId}</p>
                      <div className="space-y-2">
                        <Label htmlFor="revoke-confirm">
                          Type an operator UUID to enable its revoke action
                        </Label>
                        <Input
                          id="revoke-confirm"
                          value={confirmation}
                          onChange={(e) => setConfirmation(e.target.value)}
                        />
                      </div>
                      <Button
                        variant="outline"
                        disabled={busy || confirmation !== operator.gotrueUserId}
                        onClick={() => void run(operator.gotrueUserId, 'DELETE')}
                      >
                        Revoke access
                      </Button>
                      {error && (
                        <p role="alert" className="text-destructive">
                          {error}
                        </p>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          The last dashboard administrator cannot be removed. Revoking your own access will prevent
          further administrative requests.
        </p>
        <Pagination
          page={page}
          hasMore={Boolean(resource.data?.hasMore)}
          disabled={resource.loading}
          onChange={setPage}
        />
      </div>
    </DashboardLayout>
  )
}
