export type ApiClientOptions = {
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

export type ApiClient = {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
  delete<T>(path: string): Promise<T>
  // Calls `listener` whenever an /api/ route answers 401: the Session is gone. Returns an unsubscribe.
  onUnauthorized(listener: () => void): () => void
}

export class ApiError extends Error {
  readonly status: number
  // The server's own short plain-text message, such as which setting it refused; may be empty.
  readonly detail: string

  constructor(status: number, message: string, detail = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function createApiClient({ baseUrl, fetch = globalThis.fetch }: ApiClientOptions): ApiClient {
  const unauthorizedListeners = new Set<() => void>()

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = { method, credentials: 'include' }
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(body)
    }
    const response = await fetch(baseUrl + path, init)
    if (response.status === 401 && path.startsWith('/api/')) {
      unauthorizedListeners.forEach((listener) => listener())
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).trim()
      throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`, detail)
    }
    if (response.status === 204) {
      return undefined as T
    }
    return (await response.json()) as T
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
    onUnauthorized(listener) {
      unauthorizedListeners.add(listener)
      return () => unauthorizedListeners.delete(listener)
    },
  }
}
