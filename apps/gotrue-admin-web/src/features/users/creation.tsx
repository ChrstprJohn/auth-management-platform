import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { emailSchema, newPasswordSchema } from '@/features/auth/schemas';
import { ApiFailure } from '@/lib/api/client';
import { toast } from 'sonner';
import { failureMessage } from '@/lib/api/feedback';

export const createSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  confirmation: z.enum(
    ['require_verification', 'operator_confirmed'],
    'Choose a confirmation policy.',
  ),
});

function useCreationController() {
  const { runtime, generation } = useSession();
  const location = useLocation();
  const busy = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: '', password: '' },
  });
  // This controller lives above routes: leaving Users must not release the
  // mutation lock or discard an uncertain creation result.
  const mutation = useMutation({
    mutationFn: () => {
      const request = runtime.protectedCall(() =>
        operatorApi.create(form.getValues()),
      );
      form.resetField('password');
      setVisible(false);
      return request;
    },
    onSuccess: () => {
      if (runtime.generation() !== generation) return;
      setOpen(false);
      form.reset({ email: '', password: '' });
      toast.success('User created');
      void runtime.client.invalidateQueries({
        queryKey: ['private', generation],
      });
    },
    onError: (error) => {
      if (
        runtime.generation() === generation &&
        !(error instanceof ApiFailure && error.uncertain)
      )
        toast.error(failureMessage(error));
    },
  });
  const { reset: resetMutation } = mutation;
  const { reset: resetForm, resetField, setFocus } = form;
  useLayoutEffect(() => {
    setOpen(false);
    setVisible(false);
    busy.current = false;
    resetMutation();
    resetForm({ email: '', password: '' });
  }, [generation, resetMutation, resetForm]);
  useLayoutEffect(() => {
    if (location.pathname !== '/users') {
      setOpen(false);
      resetField('password');
      setVisible(false);
    }
  }, [location.pathname, resetField]);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setFocus('email'));
    return () => cancelAnimationFrame(frame);
  }, [open, setFocus]);
  const blocked =
    mutation.error instanceof ApiFailure && mutation.error.uncertain;
  const changeOpen = (value: boolean) => {
    if (busy.current && !value) return;
    if (!value) {
      if (!blocked) {
        resetMutation();
        resetForm({ email: '', password: '' });
      } else resetField('password');
      setVisible(false);
    }
    if (value && !busy.current && !blocked) {
      resetMutation();
      resetForm({ email: '', password: '' });
    }
    setOpen(value);
  };
  const submit = form.handleSubmit(async () => {
    if (busy.current || blocked) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      // Keep only the shared client's safe error; never retry a mutation.
    } finally {
      if (runtime.generation() === generation) {
        resetField('password');
        setVisible(false);
        busy.current = false;
      }
    }
  });
  return {
    open,
    changeOpen,
    afterOpenChange: (value: boolean) => {
      if (!value && !open && opener.current?.isConnected)
        opener.current.focus();
    },
    opener,
    form,
    submit,
    blocked,
    pending: mutation.isPending,
    error: mutation.error,
    visible,
    toggle: () => setVisible((value) => !value),
    start: (event: React.MouseEvent<HTMLElement>) => {
      opener.current = event.currentTarget;
      changeOpen(true);
    },
    openFromRoute: () => changeOpen(true),
  };
}
const CreationContext = createContext<ReturnType<
  typeof useCreationController
> | null>(null);
export function UserCreationProvider({ children }: { children: ReactNode }) {
  const model = useCreationController();
  return (
    <CreationContext.Provider value={model}>
      {children}
    </CreationContext.Provider>
  );
}
export function useCreateUser() {
  const model = useContext(CreationContext);
  if (!model) throw new Error('User creation provider is missing.');
  return model;
}
const entrySchema = z.object({ createUser: z.literal(true) });
export function useCreateUserEntry() {
  const model = useCreateUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { openFromRoute, opener } = model;
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (
      !entrySchema.safeParse(location.state).success ||
      consumed.current === location.key
    )
      return;
    consumed.current = location.key;
    openFromRoute();
    navigate(
      { pathname: '/users', search: location.search },
      { replace: true, state: null },
    );
  }, [location.state, location.search, location.key, navigate, openFromRoute]);
  // A legacy route has no trigger; use the Users header action for focus return.
  const triggerRef = useCallback(
    (element: HTMLButtonElement | null) => {
      if (element && (!opener.current || !opener.current.isConnected))
        opener.current = element;
    },
    [opener],
  );
  return { ...model, triggerRef };
}
export function useLegacyCreateUserRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    navigate(
      { pathname: '/users', search: location.search },
      { replace: true, state: { createUser: true } },
    );
  }, [navigate, location.search]);
}
