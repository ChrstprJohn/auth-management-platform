import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ChartConfig = Record<string, { label: string; color: string }>

export function ChartContainer({ className, config, children, ...props }: ComponentProps<'div'> & { config: ChartConfig; children: ReactNode }) {
  const variables = Object.fromEntries(Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color])) as CSSProperties
  return <div className={cn('h-64 w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/70 [&_.recharts-tooltip-cursor]:fill-muted', className)} style={variables} {...props}>{children}</div>
}
