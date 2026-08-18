// Mirrors backend/src/common/errors/app-error-codes.ts (kept in sync manually —
// the extension and API are separate deployables).
export type ApiErrorCode =
  | 'validation_failed'
  | 'unauthenticated'
  | 'invalid_credentials'
  | 'token_expired'
  | 'token_reuse_detected'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error'
  | (string & {});

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseErrorResponse(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: unknown } } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const err = body?.error;
  return new ApiError(
    res.status,
    err?.code ?? 'internal_error',
    err?.message ?? 'Something went wrong. Please try again.',
    err?.details,
  );
}
