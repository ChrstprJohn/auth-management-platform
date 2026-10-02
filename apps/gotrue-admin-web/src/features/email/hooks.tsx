import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
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
  const form = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  });
  const mutation = useMutation({
    mutationFn: () =>
      runtime.protectedCall(() => operatorApi.invite(form.getValues('email'))),
    onSuccess: () => {
      void runtime.client.invalidateQueries({
        queryKey: ['private', generation],
      });
    },
  });
  const { reset } = mutation;
  const { reset: resetForm } = form;
  useEffect(() => {
    busy.current = false;
    reset();
    resetForm({ email: '' });
  }, [generation, reset, resetForm]);
  const blocked =
    mutation.isSuccess ||
    (mutation.error instanceof ApiFailure && mutation.error.uncertain);
  const submit = form.handleSubmit(async () => {
    if (busy.current || blocked) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Persistent safe feedback. */
    } finally {
      busy.current = false;
    }
  });
  return {
    form,
    submit,
    pending: mutation.isPending,
    blocked,
    error: mutation.error,
    result: mutation.data,
    another: () => {
      if (!busy.current && !mutation.error) {
        reset();
        resetForm({ email: '' });
      }
    },
  };
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
      if (session.runtime.generation() === submittedGeneration) session.clear();
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
