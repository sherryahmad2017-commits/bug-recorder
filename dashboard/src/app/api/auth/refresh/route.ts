import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { serverApiRequest } from '@/lib/server-api';
import { REFRESH_COOKIE, refreshCookieOptions } from '@/lib/auth-cookie';
import { ApiError } from '@/lib/api-error';

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: { code: 'unauthenticated', message: 'No session found.' } }, { status: 401 });
  }

  try {
    const result = await serverApiRequest<RefreshResult>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    const response = NextResponse.json({ accessToken: result.accessToken });
    response.cookies.set(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      // Expired / reused / revoked — clear the dead cookie so the client
      // falls through to the login screen instead of retrying forever.
      const response = NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }
    throw error;
  }
}
