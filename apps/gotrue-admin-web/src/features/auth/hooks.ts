import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { loginSchema, safeReturn } from './schemas';

export function useLogin() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [visible, setVisible] = useState(false);
  const busy = useRef(false);
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: () => operatorApi.login(form.getValues()),
    onSuccess: (result) => {
      session.establish(result);
      navigate(safeReturn(params.get('returnTo')), { replace: true });
    },
  });
  const { resetField } = form;
  const { reset } = mutation;
  useEffect(
    () => () => {
      resetField('password');
      reset();
    },
    [resetField, reset],
  );
  const submit = form.handleSubmit(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Safe mutation error is rendered. */
    } finally {
      form.resetField('password');
      busy.current = false;
    }
  });
  return {
    form,
    submit,
    visible,
    toggle: () => setVisible(!visible),
    pending: mutation.isPending,
    error: mutation.error,
  };
}
export function useAccount() {
  const session = useSession();
  const navigate = useNavigate();
  const busy = useRef(false);
  const mutation = useMutation({
    mutationFn: operatorApi.logout,
    onSuccess: () => {
      session.clear();
      navigate('/login', { replace: true });
    },
  });
  const logout = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Failed logout retains session and visible feedback. */
    } finally {
      busy.current = false;
    }
  };
  return {
    session: session.session,
    pending: mutation.isPending,
    error: mutation.error,
    logout,
    retry: session.retry,
  };
}
