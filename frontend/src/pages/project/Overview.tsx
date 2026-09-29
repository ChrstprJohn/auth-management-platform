import type { ElementType } from 'react'
import { useParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, CheckCircle2, Clock3, Users } from 'lucide-react'
import { MOCK_PROJECTS } from '@/types/project'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

const signups = [
  { day: 'Aug 23', users: 5 }, { day: 'Aug 24', users: 8 }, { day: 'Aug 25', users: 6 },
  { day: 'Aug 26', users: 11 }, { day: 'Aug 27', users: 9 }, { day: 'Aug 28', users: 14 }, { day: 'Aug 29', users: 18 },
]
const recentSignups = [
  { email: 'john@email.com', date: 'Today, 10:42 AM', initials: 'J', status: 'Verified' },
  { email: 'jane@email.com', date: 'Today, 9:16 AM', initials: 'J', status: 'Pending' },
  { email: 'mike@email.com', date: 'Yesterday, 4:31 PM', initials: 'M', status: 'Verified' },
  { email: 'sara@email.com', date: 'Yesterday, 11:08 AM', initials: 'S', status: 'Verified' },
]
const signupChartConfig = { users: { label: 'New users', color: 'var(--primary)' } } satisfies ChartConfig
const distributionConfig = { verified: { label: 'Verified', color: 'var(--primary)' }, pending: { label: 'Pending', color: 'var(--muted-foreground)' } } satisfies ChartConfig

function StatCard({ label, value, description, icon: Icon, accent }: { label: string; value: string | number; description: string; icon: ElementType; accent?: boolean }) {
  return <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5">
    <div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p></div><span className={accent ? 'grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground' : 'grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground'}><Icon size={17} /></span></div>
    <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">{accent && <ArrowUpRight size={13} className="text-emerald-600" />}{description}</p>
  </CardContent></Card>
}

export function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = MOCK_PROJECTS.find((p) => p.appId === projectId)
  const total = project?.users ?? 0
  const verified = Math.round(total * 0.79)
  const pending = total - verified
  const distribution = [{ name: 'verified', value: verified, fill: 'var(--color-verified)' }, { name: 'pending', value: pending, fill: 'var(--color-pending)' }]

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">Project dashboard</p><h2 className="text-2xl font-semibold tracking-tight">Overview</h2><p className="mt-1 text-sm text-muted-foreground">Monitor authentication activity for {project?.name ?? projectId}.</p></div><Button variant="outline" size="sm">Last 7 days</Button></div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Total users" value={total} description="12.4% more than last week" icon={Users} accent /><StatCard label="Verified users" value={verified} description={`${total ? Math.round((verified / total) * 100) : 0}% verification rate`} icon={CheckCircle2} /><StatCard label="Pending verification" value={pending} description="Awaiting email confirmation" icon={Clock3} /></div>

    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-3"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Sign-up activity</CardTitle><CardDescription className="mt-1">New users created over the last 7 days.</CardDescription></div><Badge variant="success">71 this week</Badge></CardHeader><CardContent className="pt-5"><ChartContainer config={signupChartConfig} className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={signups} margin={{ left: -20, right: 8, top: 8 }}><defs><linearGradient id="signupFill" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="var(--color-users)" stopOpacity={0.28} /><stop offset="95%" stopColor="var(--color-users)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} dy={8} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', boxShadow: '0 4px 12px rgb(0 0 0 / .06)' }} /><Area type="monotone" dataKey="users" name="New users" stroke="var(--color-users)" strokeWidth={2.5} fill="url(#signupFill)" /></AreaChart></ResponsiveContainer></ChartContainer></CardContent></Card>
      <Card className="xl:col-span-2"><CardHeader><CardTitle>Verification status</CardTitle><CardDescription className="mt-1">Current user distribution.</CardDescription></CardHeader><CardContent><div className="relative"><ChartContainer config={distributionConfig} className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={56} outerRadius={76} paddingAngle={3} stroke="none" /></PieChart></ResponsiveContainer></ChartContainer><div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-2xl font-semibold tracking-tight">{total}</p><p className="text-xs text-muted-foreground">Users</p></div></div></div><div className="mt-2 grid grid-cols-2 gap-3 border-t border-border pt-4"><div><span className="flex items-center gap-2 text-xs text-muted-foreground"><i className="size-2 rounded-full bg-primary" />Verified</span><p className="mt-1 text-lg font-semibold">{verified}</p></div><div><span className="flex items-center gap-2 text-xs text-muted-foreground"><i className="size-2 rounded-full bg-muted-foreground/35" />Pending</span><p className="mt-1 text-lg font-semibold">{pending}</p></div></div></CardContent></Card>
    </div>

    <Card className="overflow-hidden"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Recent sign-ups</CardTitle><CardDescription className="mt-1">The newest users for this project.</CardDescription></div><Button variant="ghost" size="sm">View all users</Button></CardHeader><CardContent className="p-0"><ul className="divide-y divide-border">{recentSignups.map((user) => <li key={user.email} className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/50"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{user.initials}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{user.email}</p><p className="mt-0.5 text-xs text-muted-foreground">{user.date}</p></div></div><Badge variant={user.status === 'Verified' ? 'success' : 'warning'}>{user.status}</Badge></li>)}</ul></CardContent></Card>
  </div>
}
