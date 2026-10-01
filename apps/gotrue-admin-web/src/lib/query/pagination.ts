import { useSearchParams } from 'react-router-dom';
export function parsePagination(params: URLSearchParams) {
  const bounded = (key: string, fallback: number, max: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    return /^\d+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= max
      ? Number(raw)
      : fallback;
  };
  const page = bounded('page', 1, 10000);
  const perPage = bounded('perPage', 20, 100);
  const invalid =
    (params.has('page') && params.get('page') !== String(page)) ||
    (params.has('perPage') && params.get('perPage') !== String(perPage));
  return { page, perPage, invalid };
}
export function usePagination() {
  const [params, setParams] = useSearchParams();
  const pagination = parsePagination(params);
  const go = (page: number, perPage = pagination.perPage) => {
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      !Number.isInteger(perPage) ||
      perPage < 1 ||
      perPage > 100
    )
      return;
    setParams({ page: String(page), perPage: String(perPage) });
  };
  return {
    ...pagination,
    previous: () => go(pagination.page - 1),
    next: () => go(pagination.page + 1),
    resize: (value: string) => go(1, Number(value)),
    normalize: () => go(pagination.page),
  };
}
