import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OperatorSession } from '@auth/contracts';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import type { SessionRuntime } from '@/lib/query/runtime';

function useSessionController(runtime: SessionRuntime) {
  const [generation, setGeneration] = useState(runtime.generation);
  const [terminal, setTerminal] = useState<'expired' | 'denied' | null>(null);
  const query = useQuery({
    queryKey: ['session', generation],
    enabled: terminal === null,
    queryFn: ({ signal }) => operatorApi.me(signal),
  });
  useEffect(
    () =>
      runtime.listen((denied) => {
        setTerminal(denied ? 'denied' : 'expired');
        setGeneration(runtime.generation());
      }),
    [runtime],
  );
  useEffect(() => {
    if (
      terminal ||
      !(query.error instanceof ApiFailure) ||
      ![401, 403].includes(query.error.status)
    )
      return;
    runtime.clear();
    setTerminal(query.error.status === 403 ? 'denied' : 'expired');
    setGeneration(runtime.generation());
  }, [query.error, terminal, runtime]);
  const clear = () => {
    runtime.clear();
    setTerminal('expired');
    setGeneration(runtime.generation());
  };
  useEffect(() => {
    if (!query.data || terminal) return;
    const remaining = Date.parse(query.data.expiresAt) - Date.now();
    const timer = window.setTimeout(
      () => {
        runtime.clear();
        setTerminal('expired');
        setGeneration(runtime.generation());
      },
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timer);
  }, [query.data, terminal, runtime]);
  const establish = (session: OperatorSession) => {
    runtime.clear();
    const next = runtime.generation();
    runtime.client.setQueryData(['session', next], session);
    setTerminal(null);
    setGeneration(next);
  };
  const failure = query.error;
  const state =
    terminal ??
    (query.isPending
      ? 'loading'
      : failure instanceof ApiFailure && failure.status === 401
        ? 'expired'
        : failure instanceof ApiFailure && failure.status === 403
          ? 'denied'
          : failure
            ? 'unavailable'
            : 'authenticated');
  return {
    state,
    session: state === 'authenticated' ? query.data : undefined,
    error: failure,
    runtime,
    generation,
    clear,
    establish,
    retry: () => {
      void query.refetch();
    },
  };
}
const SessionContext = createContext<ReturnType<
  typeof useSessionController
> | null>(null);
export function SessionProvider({
  runtime,
  children,
}: {
  runtime: SessionRuntime;
  children: ReactNode;
}) {
  const value = useSessionController(runtime);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session provider is missing.');
  return session;
}
