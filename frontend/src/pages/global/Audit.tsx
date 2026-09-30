import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { useCallback, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ResourceState } from '@/components/common/resource-state'
import { Pagination } from '@/components/common/pagination'
import { useResource } from '@/hooks/use-resource'
import { adminApi } from '@/services/admin-api'
export function AuditPage() {
  const [page, setPage] = useState(1)
  const load = useCallback(() => adminApi.audit(page), [page])
  const resource = useResource(load)
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <h1 className="text-2xl font-semibold">Audit history</h1>
        <p className="text-muted-foreground">
          Administrative actions and membership enrollment recorded by this platform.
        </p>
        <ResourceState {...resource} retry={resource.reload} />
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b">
                {['Time', 'Action', 'Actor UUID', 'Target UUID'].map((label) => (
                  <TableHead key={label} className="p-3 text-left">
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {resource.data?.data.map((event) => (
                <TableRow key={event.id} className="border-b">
                  <TableCell className="whitespace-nowrap p-3">
                    {new Date(event.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="p-3">{event.action}</TableCell>
                  <TableCell className="p-3 font-mono text-xs">{event.actorId}</TableCell>
                  <TableCell className="p-3 font-mono text-xs">{event.targetId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {resource.data && !resource.data.data.length && (
            <p className="py-8 text-muted-foreground">No recorded events yet.</p>
          )}
        </div>
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
