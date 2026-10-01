export interface OperatorSession {
  operator: { id: string; email: string };
  expiresAt: string;
}

export interface ApiErrorResponse {
  error: { code: string; message: string };
  requestId: string;
}
