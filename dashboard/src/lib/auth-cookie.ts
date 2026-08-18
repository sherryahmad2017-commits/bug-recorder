export const REFRESH_COOKIE = 'reproflow_refresh_token';

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // Matches backend REFRESH_TOKEN_TTL_DAYS default (see backend/.env.example).
  maxAge: 60 * 60 * 24 * 30,
};
