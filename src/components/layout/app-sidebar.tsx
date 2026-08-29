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

export function AppSidebar() {
  return (
    <nav className="w-64 bg-sidebar flex-shrink-0 border-r border-input/20 p-4 flex flex-col gap-2">
      {projects.map((p) => (
        <div
          key={p.appId}
          className="group rounded-md p-3 text-sm hover:bg-accent/10 accent-color:focus-visible ring-2 ring-inset ring-accent/40"
        >
          <div className="flex items-center justify-between">
            <span className="line-clamp-1">{p.name}</span>
            <span className="text-muted-foreground/70">{p.users} users</span>
          </div>
          <button
            className="mt-1 w-full rounded-md bg-primary/5 text-primary font-medium px-3 py-1.5 text-xs"
          >
            [Open Project]
          </button>
        </div>
      ))}
    </nav>
  )
}
