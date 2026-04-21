const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function apiFetch(path: string, options: RequestInit & { token?: string } = {}) {
  const { token, ...fetchOpts } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOpts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOpts.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return res.json();
}
