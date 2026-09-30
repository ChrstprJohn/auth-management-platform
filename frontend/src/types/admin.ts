export interface DashboardOperator {
  gotrueUserId: string
  createdAt: string
}

export interface AuditEvent {
  id: string
  actorId: string
  action: string
  targetId: string
  createdAt: string
}
