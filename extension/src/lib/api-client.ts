import { API_BASE_URL } from './config';
import { clearSession, getAccessToken, getRefreshToken, setSession } from './auth-store';
import { parseErrorResponse } from './api-error';
import type { CurrentUser } from './types';

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; locale: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw await parseErrorResponse(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<AuthResult['user']> {
  const result = await request<AuthResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setSession(result.accessToken, result.refreshToken);
  return result.user;
}

export async function signup(input: {
  email: string;
  password: string;
  fullName: string;
  organisationName: string;
}): Promise<AuthResult['user']> {
  const result = await request<AuthResult>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  await setSession(result.accessToken, result.refreshToken);
  return result.user;
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => {});
  }
  await clearSession();
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;
  try {
    const result = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    await setSession(result.accessToken, result.refreshToken);
    return true;
  } catch {
    await clearSession();
    return false;
  }
}

/** Authenticated fetch — retries once after a silent refresh on 401. */
export async function apiFetch<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch<T>(path, init, true);
  }

  if (!res.ok) throw await parseErrorResponse(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Establishes a session on panel open from a stored refresh token, if any.
 * Returns the current user, or null if there's no valid session.
 */
export async function restoreSession(): Promise<CurrentUser | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    const refreshed = await refreshSession();
    if (!refreshed) return null;
  }
  try {
    return await apiFetch<CurrentUser>('/me');
  } catch {
    return null;
  }
}
