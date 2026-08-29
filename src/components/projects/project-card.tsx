import type { Project } from '@/types/project'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ProjectCardProps {
  project: Project
  onSelect: () => void
}

export function ProjectCard({ project, onSelect }: ProjectCardProps) {
  return (
    <Card className="group flex min-h-52 flex-col transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5">
      {/* Project name */}
      <div>
        <h3 className="text-base font-semibold tracking-tight">{project.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Authentication</p>
      </div>

      {/* User count */}
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-md bg-muted"><Users size={14} /></span>
        <span>{project.users} users</span>
      </div>

      {/* Open button */}
      <Button
        id={`open-project-${project.appId}`}
        type="button"
        onClick={onSelect}
        variant="outline"
        className="mt-auto w-full group-hover:border-primary/30 group-hover:bg-primary/5"
      >
        Open Project
      </Button>
      </CardContent>
    </Card>
  )
}
