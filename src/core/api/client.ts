export type ApiClientOptions = {
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

export type ApiClient = {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function createApiClient({ baseUrl, fetch = globalThis.fetch }: ApiClientOptions): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = { method, credentials: 'include' }
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(body)
    }
    const response = await fetch(baseUrl + path, init)
    if (!response.ok) {
      throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`)
    }
    if (response.status === 204) {
      return undefined as T
    }
    return (await response.json()) as T
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
  }
}
