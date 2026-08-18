// Stable machine-readable error codes returned as error.code in every API error
// response. Clients (extension + dashboard) switch on these, never on message text.
export enum AppErrorCode {
  VALIDATION_FAILED = 'validation_failed',
  UNAUTHENTICATED = 'unauthenticated',
  INVALID_CREDENTIALS = 'invalid_credentials',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_REUSE_DETECTED = 'token_reuse_detected',
  FORBIDDEN = 'forbidden',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  RATE_LIMITED = 'rate_limited',
  INTERNAL = 'internal_error',
}
