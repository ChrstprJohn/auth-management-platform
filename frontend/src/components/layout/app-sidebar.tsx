import { NavLink, useParams } from 'react-router-dom'
import { LayoutDashboard, Users, Code2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, segment: 'overview' },
  { label: 'Users', icon: Users, segment: 'users' },
  { label: 'API', icon: Code2, segment: 'api' },
  { label: 'Settings', icon: Settings, segment: 'settings' },
]

/**
 * Project-scoped sidebar.
 * Shows the current project name and links: Overview / Users / API / Settings.
 */
export function AppSidebar({ name }: { name: string }) {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <aside className="shrink-0 border-b border-border bg-sidebar flex flex-col md:w-56 md:border-b-0 md:border-r">
      {/* Project name header */}
      <div className="px-4 py-4 border-b border-border">
        <p className="text-sm font-semibold truncate">{name}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 flex flex-row flex-wrap gap-0.5 md:flex-col">
        {NAV_ITEMS.map(({ label, icon: Icon, segment }) => (
          <NavLink
            key={segment}
            to={`/projects/${projectId}/${segment}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              )
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
