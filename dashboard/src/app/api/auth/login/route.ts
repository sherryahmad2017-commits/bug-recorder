import { NextResponse } from 'next/server';
import { serverApiRequest } from '@/lib/server-api';
import { REFRESH_COOKIE, refreshCookieOptions } from '@/lib/auth-cookie';
import { ApiError } from '@/lib/api-error';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; locale: string };
}

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const result = await serverApiRequest<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const response = NextResponse.json({ accessToken: result.accessToken, user: result.user });
    response.cookies.set(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    throw error;
  }
}
