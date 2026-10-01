import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { emailSchema, newPasswordSchema } from '@/features/auth/schemas';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { useSession } from '@/app/session';

export const resetSchema = z
  .object({ password: newPasswordSchema, confirmation: z.string() })
  .refine((value) => value.password === value.confirmation, {
    message: 'Passwords must match.',
    path: ['confirmation'],
  });
const forgotSchema = z.object({ email: emailSchema });
export function useForgotPassword() {
  const form = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });
  const busy = useRef(false);
  const mutation = useMutation({
    mutationFn: () => operatorApi.forgot(form.getValues()),
  });
  const submit = form.handleSubmit(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Render safe error. */
    } finally {
      busy.current = false;
    }
  });
  return {
    form,
    submit,
    pending: mutation.isPending,
    success: mutation.isSuccess,
    error: mutation.error,
    localMail: ['localhost', '127.0.0.1'].includes(window.location.hostname),
  };
}
export function useResetPassword() {
  const session = useSession();
  const busy = useRef(false);
  const [visible, setVisible] = useState(false);
  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmation: '' },
  });
  const mutation = useMutation({
    mutationFn: () =>
      operatorApi.reset({ password: form.getValues('password') }),
    onSuccess: () => session.clear(),
    onError: (error) => {
      if (error instanceof ApiFailure && error.uncertain) session.clear();
    },
  });
  const { reset: resetForm } = form;
  const { reset: resetMutation } = mutation;
  useEffect(
    () => () => {
      resetForm();
      resetMutation();
    },
    [resetForm, resetMutation],
  );
  const submit = form.handleSubmit(async () => {
    if (
      busy.current ||
      mutation.isSuccess ||
      (mutation.error instanceof ApiFailure && mutation.error.uncertain)
    )
      return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Render safe error. */
    } finally {
      form.reset();
      busy.current = false;
    }
  });
  // A submitted reset consumes context even when GoTrue rejects the password.
  const blocked = mutation.isSuccess || mutation.isError;
  return {
    form,
    submit,
    visible,
    toggle: () => setVisible(!visible),
    pending: mutation.isPending,
    success: mutation.isSuccess,
    error: mutation.error,
    blocked,
  };
}
