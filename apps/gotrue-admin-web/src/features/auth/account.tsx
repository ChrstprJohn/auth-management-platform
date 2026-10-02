import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { failureMessage } from '@/lib/api/feedback';

function useAccountController() {
  const session = useSession();
  const navigate = useNavigate();
  const busy = useRef(false);
  const mutation = useMutation({
    mutationFn: async () => {
      const generation = session.runtime.generation();
      await session.runtime.protectedCall(operatorApi.logout);
      return generation;
    },
    onSuccess: (generation) => {
      if (session.runtime.generation() !== generation) return;
      session.clear();
      toast.success('Signed out');
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      if (session.runtime.generation() !== session.generation) return;
      if (!(error instanceof ApiFailure && error.uncertain))
        toast.error(failureMessage(error));
    },
  });
  const { reset } = mutation;
  useEffect(() => {
    busy.current = false;
    reset();
  }, [session.generation, reset]);
  const uncertain =
    mutation.error instanceof ApiFailure && mutation.error.uncertain;
  const logout = async () => {
    if (busy.current || uncertain) return;
    busy.current = true;
    const generation = session.runtime.generation();
    try {
      await mutation.mutateAsync();
    } catch {
      /* A failed logout retains the session for deliberate inspection. */
    } finally {
      if (session.runtime.generation() === generation) busy.current = false;
    }
  };
  return {
    session: session.session,
    pending: mutation.isPending,
    uncertain,
    error: mutation.error,
    logout,
    retry: session.retry,
  };
}
const AccountContext = createContext<ReturnType<
  typeof useAccountController
> | null>(null);
export function AccountActionsProvider({ children }: { children: ReactNode }) {
  const model = useAccountController();
  return (
    <AccountContext.Provider value={model}>{children}</AccountContext.Provider>
  );
}
export function useAccount() {
  const model = useContext(AccountContext);
  if (!model) throw new Error('Account actions provider is missing.');
  return model;
}
