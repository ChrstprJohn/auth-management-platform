import type { ReactNode } from 'react';
import { Brand } from './brand';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './ui/card';

// The official login-03 block layout, adapted to our existing password/recovery flows.
export function AuthLayout({
  title,
  description,
  children,
  footer,
  navigation,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  navigation?: ReactNode;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-svh min-w-0 flex-col items-center justify-center gap-6 bg-muted/50 p-4 sm:p-8"
    >
      <div className="flex w-full min-w-0 max-w-md flex-col gap-6">
        <Brand className="self-center" />
        <Card className="min-w-0 [--card-spacing:--spacing(6)]">
          <CardHeader className="text-center">
            <CardTitle>
              <h1 className="text-xl">{title}</h1>
            </CardTitle>
            <CardDescription className="leading-relaxed">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-5">{children}</CardContent>
          {navigation && (
            <CardFooter className="flex-col items-stretch gap-3">
              {navigation}
            </CardFooter>
          )}
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
