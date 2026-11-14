export type ApiClientOptions = {
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

export type ApiClient = {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  // POSTs, and says which 2xx the server answered with, for a route where it means something, such
  // as 201 for a new Word Request and 200 for one already there.
  postWithStatus<T>(path: string, body?: unknown): Promise<{ status: number; body: T }>
  put<T>(path: string, body: unknown): Promise<T>
  delete<T>(path: string): Promise<T>
  // GETs a file, such as the JLPT deck: named from the response's Content-Disposition (else the
  // path's last part) and typed from its Content-Type, without parameters such as the charset.
  file(path: string): Promise<File>
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

  async function send(method: string, path: string, body?: unknown): Promise<Response> {
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
    return response
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await send(method, path, body)
    if (response.status === 204) {
      return undefined as T
    }
    return (await response.json()) as T
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    async postWithStatus(path, body) {
      const response = await send('POST', path, body)
      return { status: response.status, body: await response.json() }
    },
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
    async file(path) {
      const response = await send('GET', path)
      const name = fileName(response.headers.get('Content-Disposition')) ?? path.split('/').pop()!
      const type = (response.headers.get('Content-Type') ?? '').split(';')[0].trim()
      return new File([await response.arrayBuffer()], name, { type })
    },
    onUnauthorized(listener) {
      unauthorizedListeners.add(listener)
      return () => unauthorizedListeners.delete(listener)
    },
  }
}

// The file name a Content-Disposition header gives, such as `jlpt-2026-11-11.csv`, or null.
function fileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      // Malformed: the plain filename, if there is one, will do.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(contentDisposition)
  return plain ? plain[1] : null
}
