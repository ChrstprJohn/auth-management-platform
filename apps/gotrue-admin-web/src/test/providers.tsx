import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '@/app/session';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createSessionRuntime } from '@/lib/query/runtime';
import { UserActionsProvider } from '@/features/users/actions';

export const fixtureSession = {
  operator: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'controlled@example.test',
  },
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
export function renderApp(view: React.ReactNode, route = '/') {
  const runtime = createSessionRuntime();
  const result = render(
    <QueryClientProvider client={runtime.client}>
      <SessionProvider runtime={runtime}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[route]}>
            <UserActionsProvider>{view}</UserActionsProvider>
          </MemoryRouter>
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>,
  );
  return { ...result, runtime };
}
