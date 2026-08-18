import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { serverApiRequest } from '@/lib/server-api';
import { REFRESH_COOKIE } from '@/lib/auth-cookie';

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    // Best-effort — the cookie is cleared either way so the user is logged
    // out of this browser even if the API call fails.
    await serverApiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => {});
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
