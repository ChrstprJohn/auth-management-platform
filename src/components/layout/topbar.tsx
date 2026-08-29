interface ProjectNavItem {
  name: string
  users: number
  appId: string
}

const projects: ProjectNavItem[] = [
  { name: 'CRM', users: 124, appId: 'crm' },
  { name: 'Dental Website', users: 38, appId: 'dental' },
  { name: 'Portfolio', users: 8, appId: 'portfolio' },
]

const sortedProjects = [...projects].sort((a, b) => b.users - a.users)

export function Topbar() {
  return (
    <header className="border-b border-input/20 bg-card/50 px-4 py-2 flex items-center gap-4">
      <h1 className="text-sm font-medium truncate">Auth Dashboard</h1>
      <div className="flex items-center gap-3">
        {sortedProjects.map((p) => (
          <button
            key={p.appId}
            type="button"
            className="flex items-center rounded-md border border-input/20 bg-white/50 px-3 py-1.5 text-sm font-medium hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="line-clamp-1">{p.name}</span>
            <span className="ml-1 text-xs font-medium text-muted-foreground">{p.users} users</span>
          </button>
        ))}
        <button
          type="button"
          className="rounded-md bg-primary text-primary px-3 py-1.5 text-sm font-medium hover:bg-primary/10"
        >
          [+ New Project]
        </button>
      </div>
    </header>
  )
}