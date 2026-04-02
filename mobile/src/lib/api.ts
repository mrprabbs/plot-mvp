import Constants from 'expo-constants';

const apiBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'https://api.plot-parking.com';

async function parseJson(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  const data = await parseJson(response);
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data ? String((data as { message: unknown }).message) : 'Request failed';
    throw new Error(message);
  }

  return data as T;
}

export { apiBaseUrl };
