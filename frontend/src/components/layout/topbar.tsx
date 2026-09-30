import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TopbarProps {
  /** Optional breadcrumb or subtitle text shown after the brand name */
  breadcrumb?: string
  /** Optional action element in the top-right (e.g. "+ New Project") */
  action?: ReactNode
}

export function Topbar({ breadcrumb, action }: TopbarProps) {
  const { logout } = useAuth()

  return (
    <header className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          to="/projects"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-primary shrink-0"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            A
          </span>
          <span className="hidden sm:inline">Auth Management Platform</span>
          <span className="sm:hidden">Auth Platform</span>
        </Link>
        {breadcrumb && (
          <>
            <span className="text-muted-foreground/40 select-none">/</span>
            <span className="text-sm text-muted-foreground truncate">{breadcrumb}</span>
          </>
        )}
      </div>

      {/* Right: contextual action + logout */}
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Global administration" className="flex flex-wrap gap-1 text-sm">
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }
            >
              Projects
            </NavLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/users"
              className={({ isActive }) =>
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }
            >
              Accounts
            </NavLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/operators"
              className={({ isActive }) =>
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }
            >
              Operators
            </NavLink>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <NavLink
              to="/audit"
              className={({ isActive }) =>
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }
            >
              Audit
            </NavLink>
          </Button>
        </nav>
        {action}
        <Button
          type="button"
          onClick={logout}
          title="Sign out"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <LogOut size={13} />
          Sign out
        </Button>
      </div>
    </header>
  )
}
