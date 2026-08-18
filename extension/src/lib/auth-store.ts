// chrome.storage.session holds the short-lived access token (cleared when the
// browser closes); chrome.storage.local holds the refresh token so a session
// survives a browser restart. Neither is reachable from content scripts or
// web pages — only this extension's own contexts. See docs/ARCHITECTURE.md §10.

const ACCESS_TOKEN_KEY = 'reproflow_access_token';
const REFRESH_TOKEN_KEY = 'reproflow_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.session.get(ACCESS_TOKEN_KEY);
  return (result[ACCESS_TOKEN_KEY] as string | undefined) ?? null;
}

export async function setAccessToken(token: string): Promise<void> {
  await chrome.storage.session.set({ [ACCESS_TOKEN_KEY]: token });
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(REFRESH_TOKEN_KEY);
  return (result[REFRESH_TOKEN_KEY] as string | undefined) ?? null;
}

export async function setRefreshToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [REFRESH_TOKEN_KEY]: token });
}

export async function setSession(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([setAccessToken(accessToken), setRefreshToken(refreshToken)]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    chrome.storage.session.remove(ACCESS_TOKEN_KEY),
    chrome.storage.local.remove(REFRESH_TOKEN_KEY),
  ]);
}
