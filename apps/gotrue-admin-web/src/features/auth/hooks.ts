import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { loginSchema, safeReturn } from './schemas';
import { toast } from 'sonner';
export { useAccount } from './account';

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
    mutationFn: async () => {
      const generation = session.runtime.generation();
      const request = operatorApi.login(form.getValues());
      form.resetField('password');
      setVisible(false);
      return { result: await request, generation };
    },
    onSuccess: ({ result, generation }) => {
      if (session.runtime.generation() !== generation) return;
      session.establish(result);
      toast.success('Signed in');
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
