import type { ReactNode } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Label,
  AreaChart,
  Area,
} from 'recharts';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';

type Count = { label: string; count: number };
export function DailyActivity({
  data,
}: {
  data: Array<{ date: string; attempts: number; unresolved: number }>;
}) {
  const config = {
    attempts: { label: 'Attempts', color: 'var(--chart-2)' },
    unresolved: { label: 'Unresolved', color: 'var(--chart-4)' },
  } satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Activity by day</h3>
        </CardTitle>
        <CardDescription>
          UTC dates represented in the latest 20 records. Gaps and earlier
          activity are not inferred.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer
          config={config}
          className="h-64 w-full"
          aria-hidden="true"
        >
          <AreaChart
            data={data}
            accessibilityLayer={false}
            margin={{ left: -20, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="attempts"
              type="linear"
              fill="var(--color-attempts)"
              fillOpacity={0.15}
              stroke="var(--color-attempts)"
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Area
              dataKey="unresolved"
              type="linear"
              fill="var(--color-unresolved)"
              fillOpacity={0.12}
              stroke="var(--color-unresolved)"
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
        <dl
          aria-label="Daily activity counts"
          className="grid gap-2 border-t pt-4 text-sm sm:grid-cols-2"
        >
          {data.map((day) => (
            <div
              key={day.date}
              className="flex flex-wrap justify-between gap-2"
            >
              <dt>{day.date}</dt>
              <dd>
                {day.attempts} attempts · {day.unresolved} unresolved
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
const chartConfig = {
  count: { label: 'Records', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function SnapshotChart({
  title,
  description,
  data,
  children,
}: {
  title: string;
  description: string;
  data: Count[];
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h3 className="text-base font-medium">{title}</h3>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <dl
          aria-label={`${title} counts`}
          className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4"
        >
          {data.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <dt className="capitalize text-muted-foreground">{row.label}</dt>
              <dd className="font-medium tabular-nums">{row.count}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function ConfirmationChart({ data }: { data: Count[] }) {
  const slices = data.map((row, index) => ({
    ...row,
    fill: index === 0 ? 'var(--chart-2)' : 'var(--chart-1)',
  }));
  return (
    <SnapshotChart
      title="Email confirmation"
      description="A missing confirmation date stays unreported."
      data={data}
    >
      <ChartContainer
        config={chartConfig}
        className="h-56 w-full"
        aria-hidden="true"
      >
        <PieChart accessibilityLayer={false}>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="label" hideLabel />}
          />
          <Pie
            data={slices}
            dataKey="count"
            nameKey="label"
            innerRadius={64}
            outerRadius={94}
            strokeWidth={3}
            isAnimationActive={false}
          >
            <Label
              value="Users"
              position="center"
              className="fill-muted-foreground text-sm"
            />
          </Pie>
        </PieChart>
      </ChartContainer>
    </SnapshotChart>
  );
}

export function OutcomeChart({
  data,
  unresolved,
}: {
  data: Count[];
  unresolved: number;
}) {
  const colors = [
    'var(--chart-2)',
    'var(--chart-4)',
    'var(--chart-3)',
    'var(--chart-1)',
  ];
  const slices = data.map((row, index) => ({ ...row, fill: colors[index] }));
  return (
    <SnapshotChart
      title="Recorded outcomes"
      description={`${unresolved} unresolved records in this page. Pending and unknown are not completed outcomes.`}
      data={data}
    >
      <ChartContainer
        config={chartConfig}
        className="h-56 w-full"
        aria-hidden="true"
      >
        <PieChart accessibilityLayer={false}>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="label" hideLabel />}
          />
          <Pie
            data={slices}
            dataKey="count"
            nameKey="label"
            outerRadius={94}
            strokeWidth={3}
            isAnimationActive={false}
          />
        </PieChart>
      </ChartContainer>
    </SnapshotChart>
  );
}

export function ActivityChart({ data }: { data: Count[] }) {
  return (
    <SnapshotChart
      title="Management activity"
      description="Attempt counts by action, including unresolved attempts."
      data={data}
    >
      <ChartContainer
        config={chartConfig}
        className="h-56 w-full"
        aria-hidden="true"
      >
        <BarChart
          data={data}
          accessibilityLayer={false}
          margin={{ left: -20, right: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
    </SnapshotChart>
  );
}

export function BanBreakdown({
  data,
}: {
  data: Array<Count & { percentage: number }>;
}) {
  return (
    <section
      aria-labelledby="ban-breakdown"
      className="flex min-w-0 flex-col justify-center gap-6 px-1 py-4 sm:px-6"
    >
      <div className="space-y-1">
        <h3 id="ban-breakdown" className="text-base font-medium">
          Ban status
        </h3>
        <p className="text-sm text-muted-foreground">
          Share of this user page. Unknown is counted separately.
        </p>
      </div>
      <div className="space-y-6">
        {data.map((row) => (
          <div key={row.label} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>{row.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.count} · {Math.round(row.percentage)}%
              </span>
            </div>
            <Progress
              value={row.percentage}
              aria-label={`${row.label}: ${row.count} records`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
