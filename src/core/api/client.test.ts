import { describe, expect, it } from 'vitest'
import { ApiError, createApiClient } from './client'

type Call = { url: string; init: RequestInit }

function fakeFetch(response: () => Response) {
  const calls: Call[] = []
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init })
    return response()
  }
  return { fetch, calls }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('API client', () => {
  it('GETs from the API base URL with the session cookie and returns the JSON body', async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { kcal: 1800 }))
    const api = createApiClient({ baseUrl: 'https://api.example.com', fetch })

    const body = await api.get('/calories/limit')

    expect(body).toEqual({ kcal: 1800 })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.example.com/calories/limit')
    expect(calls[0].init.method).toBe('GET')
    expect(calls[0].init.credentials).toBe('include')
  })

  it('POSTs a JSON body with the session cookie', async () => {
    const { fetch, calls } = fakeFetch(() => json(201, { id: 'e1' }))
    const api = createApiClient({ baseUrl: 'https://api.example.com', fetch })

    const body = await api.post('/calories/entries', { name: 'Onigiri', kcal: 180, servings: 2 })

    expect(body).toEqual({ id: 'e1' })
    expect(calls[0].url).toBe('https://api.example.com/calories/entries')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.credentials).toBe('include')
    expect(new Headers(calls[0].init.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ name: 'Onigiri', kcal: 180, servings: 2 })
  })

  it('resolves to undefined when the API answers 204 No Content', async () => {
    const { fetch } = fakeFetch(() => new Response(null, { status: 204 }))
    const api = createApiClient({ baseUrl: 'https://api.example.com', fetch })

    await expect(api.post('/core/sign-out', {})).resolves.toBeUndefined()
  })

  it('rejects with an ApiError carrying the status when the API answers with an error', async () => {
    const { fetch } = fakeFetch(() => json(401, { error: 'not signed in' }))
    const api = createApiClient({ baseUrl: 'https://api.example.com', fetch })

    const failure = api.get('/core/settings')

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({ status: 401 })
  })
})
