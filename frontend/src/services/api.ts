const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1'

function getToken(): string | null {
  return localStorage.getItem('token')
}

// Render 무료 서버가 잠에서 깨는 데 1분 가까이 걸려서 넉넉히 잡고 그래도 응답이 없으면 끊는다
const REQUEST_TIMEOUT_MS = 70_000

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')
  }
  if (!res.ok) {
    const fallback = res.status >= 500
      ? '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.'
      : '오류가 발생했습니다.'
    const err = await res.json().catch(() => ({ detail: fallback }))
    throw new Error(err.detail ?? '오류가 발생했습니다.')
  }
  if (res.status === 204) return null as T
  return res.json()
}

export const api = {
  get:    <T>(path: string)                    => request<T>(path),
  post:   <T>(path: string, body: unknown)     => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)     => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)     => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                   => request<T>(path, { method: 'DELETE' }),
}
