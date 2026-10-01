import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession } from '@/app/session';
import { operatorApi } from '@/lib/api/operator';
import { ApiFailure } from '@/lib/api/client';
import { emailSchema, newPasswordSchema } from '@/features/auth/schemas';
import { usePagination } from '@/lib/query/pagination';

export const createSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  confirmation: z.enum(
    ['require_verification', 'operator_confirmed'],
    'Choose a confirmation policy.',
  ),
});
export function useUsersPage() {
  const { runtime, generation } = useSession();
  const pagination = usePagination();
  const query = useQuery({
    queryKey: [
      'private',
      generation,
      'users',
      pagination.page,
      pagination.perPage,
    ],
    queryFn: ({ signal }) =>
      runtime.protectedCall(() =>
        operatorApi.users(pagination.page, pagination.perPage, signal),
      ),
  });
  return {
    pagination,
    data: query.data,
    error: query.error,
    state: query.isPending
      ? 'loading'
      : !query.data && query.isError
        ? 'error'
        : query.data?.users.length
          ? 'data'
          : 'empty',
    refreshing: query.isFetching && !query.isPending,
    refresh: () => {
      void query.refetch();
    },
  };
}
export function useUserDetails() {
  const { id: rawId = '' } = useParams();
  const parsed = z.uuid().safeParse(rawId);
  const id = parsed.success ? parsed.data.toLowerCase() : '';
  const { runtime, generation } = useSession();
  const query = useQuery({
    queryKey: ['private', generation, 'user', id],
    enabled: !!id,
    queryFn: ({ signal }) =>
      runtime.protectedCall(() => operatorApi.user(id, signal)),
  });
  const missing =
    !id || (query.error instanceof ApiFailure && query.error.status === 404);
  return {
    id,
    user: query.data?.user,
    error: query.error,
    state: missing
      ? 'missing'
      : query.isPending
        ? 'loading'
        : query.data
          ? 'data'
          : 'error',
    refreshing: query.isFetching && !query.isPending,
    refresh: () => {
      void query.refetch();
    },
  };
}
export function useCreateUser() {
  const { runtime, generation } = useSession();
  const busy = useRef(false);
  const [visible, setVisible] = useState(false);
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: () =>
      runtime.protectedCall(() => operatorApi.create(form.getValues())),
    onSuccess: () => {
      void runtime.client.invalidateQueries({
        queryKey: ['private', generation],
      });
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
  const blocked =
    mutation.isSuccess ||
    (mutation.error instanceof ApiFailure && mutation.error.uncertain);
  const submit = form.handleSubmit(async () => {
    if (busy.current || blocked) return;
    busy.current = true;
    try {
      await mutation.mutateAsync();
    } catch {
      /* Render safe failure. */
    } finally {
      form.resetField('password');
      busy.current = false;
    }
  });
  const newAccount = () => {
    mutation.reset();
    form.reset({ email: '', password: '' });
  };
  return {
    form,
    submit,
    pending: mutation.isPending,
    blocked,
    error: mutation.error,
    result: mutation.data,
    visible,
    toggle: () => setVisible(!visible),
    newAccount,
  };
}
