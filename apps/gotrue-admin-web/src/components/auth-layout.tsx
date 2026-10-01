import type { ReactNode } from 'react';
import { Brand } from './brand';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from './ui/card';

// The official login-03 block layout, adapted to our existing password/recovery flows.
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/50 px-5 py-8 sm:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Brand className="self-center" />
        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader className="text-center">
            <CardTitle>
              <h1 className="text-xl">{title}</h1>
            </CardTitle>
            <CardDescription className="leading-relaxed">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">{children}</CardContent>
        </Card>
        {footer && (
          <div className="px-2 text-center text-sm leading-relaxed text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
