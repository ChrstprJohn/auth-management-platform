import { QueryClient } from '@tanstack/react-query';
import { ApiFailure } from '../api/client';

export function createSessionRuntime() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 30000,
      },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  let generation = 0;
  let onLoss: (denied: boolean) => void = () => {};
  const clear = () => {
    generation++;
    void client.cancelQueries();
    client.clear();
  };
  async function protectedCall<T>(call: () => Promise<T>): Promise<T> {
    const started = generation;
    try {
      const result = await call();
      if (started !== generation)
        throw new ApiFailure('SESSION_CHANGED', 0, false);
      return result;
    } catch (error) {
      if (started !== generation)
        throw new ApiFailure('SESSION_CHANGED', 0, false);
      if (
        started === generation &&
        error instanceof ApiFailure &&
        (error.status === 401 || error.code === 'ACCESS_DENIED')
      ) {
        clear();
        onLoss(error.status === 403);
      }
      throw error;
    }
  }
  return {
    client,
    clear,
    protectedCall,
    generation: () => generation,
    listen: (listener: typeof onLoss) => {
      onLoss = listener;
      return () => {
        onLoss = () => {};
      };
    },
  };
}
export type SessionRuntime = ReturnType<typeof createSessionRuntime>;
