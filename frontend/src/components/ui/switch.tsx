import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Switch({ className, checked, ...props }: ComponentProps<'button'> & { checked: boolean }) {
  return <button role="switch" aria-checked={checked} className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-45', checked ? 'bg-primary' : 'bg-input', className)} {...props}><span className={cn('block size-4 rounded-full bg-background shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} /></button>
}
