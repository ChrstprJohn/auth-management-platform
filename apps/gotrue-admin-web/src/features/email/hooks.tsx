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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { emailSchema, newPasswordSchema } from '@/features/auth/schemas';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { failureMessage } from '@/lib/api/feedback';

const inviteSchema = z.object({ email: emailSchema });
export const emailProofSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .regex(/^\d{6,10}$/, 'Enter the numeric code from the newest email.'),
});
export const invitationProofSchema = emailProofSchema
  .extend({ password: newPasswordSchema, confirmation: z.string() })
  .refine((v) => v.password === v.confirmation, {
    message: 'Passwords must match.',
    path: ['confirmation'],
  });

function useInvitationController() {
  const { runtime, generation } = useSession();
  const busy = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const form = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  });
  const mutation = useMutation({
    mutationFn: () =>
      runtime.protectedCall(() => operatorApi.invite(form.getValues('email'))),
    onSuccess: () => {
      if (runtime.generation() !== generation) return;
      setOpen(false);
      form.reset({ email: '' });
      toast.success('Invitation requested');
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
  const { reset } = mutation;
  const { reset: resetForm } = form;
  useLayoutEffect(() => {
    busy.current = false;
    setOpen(false);
    reset();
    resetForm({ email: '' });
  }, [generation, reset, resetForm]);
  useLayoutEffect(() => {
    if (location.pathname !== '/users') setOpen(false);
  }, [location.pathname]);
  const { setFocus } = form;
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setFocus('email'));
    return () => cancelAnimationFrame(frame);
  }, [open, setFocus]);
  const blocked =
    mutation.error instanceof ApiFailure && mutation.error.uncertain;
  const changeOpen = (value: boolean) => {
    if (busy.current && !value) return;
    if (!busy.current && !blocked) {
      reset();
      resetForm({ email: '' });
    }
    setOpen(value);
  };
  const submit = form.handleSubmit(async () => {
    if (busy.current || blocked) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Persistent safe feedback. */
    } finally {
      if (runtime.generation() === generation) busy.current = false;
    }
  });
  return {
    form,
    open,
    changeOpen,
    opener,
    afterOpenChange: (value: boolean) => {
      if (!value && !open && opener.current?.isConnected)
        opener.current.focus();
    },
    start: (event: React.MouseEvent<HTMLElement>) => {
      opener.current = event.currentTarget;
      changeOpen(true);
    },
    openFromRoute: () => changeOpen(true),
    submit,
    pending: mutation.isPending,
    blocked,
    error: mutation.error,
  };
}
const invitationEntrySchema = z.object({ inviteUser: z.literal(true) });
export function useInviteUserEntry() {
  const model = useInviteUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { openFromRoute, opener } = model;
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (
      !invitationEntrySchema.safeParse(location.state).success ||
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
  const triggerRef = useCallback(
    (element: HTMLButtonElement | null) => {
      if (element && (!opener.current || !opener.current.isConnected))
        opener.current = element;
    },
    [opener],
  );
  return { ...model, triggerRef };
}
export function useLegacyInviteUserRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    navigate(
      { pathname: '/users', search: location.search },
      { replace: true, state: { inviteUser: true } },
    );
  }, [navigate, location.search]);
}
const InvitationContext = createContext<ReturnType<
  typeof useInvitationController
> | null>(null);
export function InvitationProvider({ children }: { children: ReactNode }) {
  const model = useInvitationController();
  return (
    <InvitationContext.Provider value={model}>
      {children}
    </InvitationContext.Provider>
  );
}
export function useInviteUser() {
  const model = useContext(InvitationContext);
  if (!model) throw new Error('Invitation provider is missing.');
  return model;
}
export function useEmailProof(invitation: boolean) {
  const session = useSession();
  const busy = useRef(false);
  const [visible, setVisible] = useState(false);
  // Empty password fields also exist on confirmation, but are never submitted there.
  const schema = invitation
    ? invitationProofSchema
    : emailProofSchema.extend({
        password: z.string(),
        confirmation: z.string(),
      });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', code: '', password: '', confirmation: '' },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const submittedGeneration = session.runtime.generation();
      const input = form.getValues();
      form.reset({
        email: input.email,
        code: '',
        password: '',
        confirmation: '',
      });
      setVisible(false);
      await (invitation
        ? operatorApi.acceptInvitation({
            email: input.email,
            code: input.code,
            password: input.password,
          })
        : operatorApi.confirmEmail({ email: input.email, code: input.code }));
      return submittedGeneration;
    },
    onSuccess: (submittedGeneration) => {
      if (session.runtime.generation() !== submittedGeneration) return;
      session.clear();
      toast.success(invitation ? 'Invitation accepted' : 'Email confirmed');
    },
  });
  const blocked = mutation.isSuccess || mutation.isError;
  const submit = form.handleSubmit(async () => {
    if (busy.current || blocked) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Code may have been consumed; do not automatically retry. */
    } finally {
      busy.current = false;
    }
  });
  const { resetField } = form;
  useEffect(
    () => () => {
      resetField('code');
      resetField('password');
      resetField('confirmation');
    },
    [resetField],
  );
  return {
    form,
    submit,
    pending: mutation.isPending,
    success: mutation.isSuccess,
    error: mutation.error,
    blocked,
    visible,
    toggle: () => setVisible(!visible),
    freshCode: () => {
      if (
        !busy.current &&
        mutation.error instanceof ApiFailure &&
        ['INVALID_EMAIL_CODE', 'EMAIL_RATE_LIMITED', 'RATE_LIMITED'].includes(
          mutation.error.code,
        )
      ) {
        mutation.reset();
        form.setFocus('code');
      }
    },
  };
}
export type EmailCallbackStatus = 'processed' | 'invalid' | 'missing';
export function consumeEmailCallback(): EmailCallbackStatus {
  if (window.location.pathname !== '/auth/callback') return 'missing';
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const result =
    hash.has('error') || url.searchParams.has('error')
      ? 'invalid'
      : hash.has('access_token')
        ? 'processed'
        : 'missing';
  // Old implicit links may reach here. Never retain or exchange their credentials.
  window.history.replaceState(null, '', '/auth/callback');
  return result;
}
