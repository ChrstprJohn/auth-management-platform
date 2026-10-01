export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const unavailable = () =>
  new ApiError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'A required service is unavailable.',
  );
export const unauthorized = () =>
  new ApiError(
    401,
    'AUTHENTICATION_REQUIRED',
    'Sign in with valid credentials.',
  );
export const forbidden = () =>
  new ApiError(403, 'ACCESS_DENIED', 'Access denied.');
