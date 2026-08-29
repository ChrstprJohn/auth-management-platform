import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
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
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border/80 bg-card/85 px-4 backdrop-blur-md sm:px-6">
      {/* Left: brand + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          to="/projects"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-primary shrink-0"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">A</span>
          Auth Dashboard
        </Link>
        {breadcrumb && (
          <>
            <span className="text-muted-foreground/40 select-none">/</span>
            <span className="text-sm text-muted-foreground truncate">{breadcrumb}</span>
          </>
        )}
      </div>

      {/* Right: contextual action + logout */}
      <div className="flex items-center gap-2 shrink-0">
        {action}
        <Button
          type="button"
          onClick={logout}
          title="Sign out"
          variant="ghost"
          size="sm"
          className="hidden text-muted-foreground sm:inline-flex"
        >
          <LogOut size={13} />
          Sign out
        </Button>
      </div>
    </header>
  )
}
