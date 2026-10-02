import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from './app/session';
import { AppRoutes } from './app/routes';
import { createSessionRuntime } from './lib/query/runtime';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import './index.css';
import { consumeEmailCallback } from './features/email/hooks';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
const runtime = createSessionRuntime();
const emailCallbackStatus = consumeEmailCallback();
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={runtime.client}>
      <SessionProvider runtime={runtime}>
        <TooltipProvider>
          <BrowserRouter>
            <AppRoutes emailCallbackStatus={emailCallbackStatus} />
            <Toaster />
          </BrowserRouter>
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
