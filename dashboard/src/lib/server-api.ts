import 'server-only';
import { parseErrorResponse } from './api-error';

// Used only inside src/app/api/auth/* route handlers — the server-side half
// of the BFF that keeps the refresh token in an httpOnly cookie the browser
// JS never touches (docs/ARCHITECTURE.md §10).
const API_URL = process.env.API_URL ?? 'http://localhost:4000/api/v1';

export async function serverApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
