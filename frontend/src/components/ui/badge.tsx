import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'outline'
const variants: Record<BadgeVariant, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:text-amber-400',
  outline: 'border border-border bg-background text-muted-foreground',
}
export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
