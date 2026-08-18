// Embedded in the access token as a cache hint only. Every write-path
// authorization decision re-derives the caller's role from
// organisation_members server-side (see docs/ARCHITECTURE.md §10) —
// nothing here is trusted on its own for a mutating request.
export interface JwtPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}
