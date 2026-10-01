import type { ReactNode } from 'react';
import { Brand } from './brand';
import { Card, CardContent } from './ui/card';

export function RouteState({ children }: { children: ReactNode }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-svh items-center justify-center bg-muted/50 p-4 sm:p-8"
    >
      <div className="flex w-full min-w-0 max-w-lg flex-col gap-6">
        <Brand className="self-center" />
        <Card>
          <CardContent className="min-w-0 space-y-4 pt-2">
            {children}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
