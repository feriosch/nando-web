import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ApiError } from '../api/client'
import type { Begin } from '../identity/passkeys'
import { useApi, useLeave, usePasskeys } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import { pillClasses } from '../ui/pill'

// A pending request to approve a Connector, as GET /auth/connect/{request} answers it.
type ConnectRequest = { clientName: string; redirectHost: string }

// The consent page, at /connect?request=<id>: the server's OAuth authorize sends the browser here
// when the Owner adds Nando as a connector in an app such as Claude. It often opens in a browser
// with no Session, so it needs none: it approves with a Passkey, without signing in.
export function Consent() {
  const api = useApi()
  const passkeys = usePasskeys()
  const leave = useLeave()
  const [params] = useSearchParams()
  const id = params.get('request') ?? ''
  const path = `/auth/connect/${encodeURIComponent(id)}`
  const request = useQuery({
    queryKey: ['connect', id],
    queryFn: () => api.get<ConnectRequest>(path),
  })

  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Runs `answer` once at a time; a problem keeps the Owner on the page with both buttons.
  async function run(answer: () => Promise<string>, name: string) {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      leave(await answer())
    } catch (error) {
      setProblem(describe(error, name))
      setBusy(false)
    }
  }

  // WebAuthn must start from a tap, so nothing is asked until the Owner presses Allow.
  async function allow() {
    const { publicKey } = await api.post<Begin<PublicKeyCredentialRequestOptionsJSON>>(`${path}/begin`)
    const credential = await passkeys.get(publicKey)
    return (await api.post<{ redirect: string }>(`${path}/finish`, credential)).redirect
  }

  async function deny() {
    return (await api.post<{ redirect: string }>(`${path}/deny`)).redirect
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <img src="/icon.svg" alt="" width={72} height={72} className="size-18 rounded-[16px]" />
        {request.error instanceof ApiError && request.error.status === 404 && (
          <p className="my-0 text-[17px]">This request has expired. Try connecting again from Claude.</p>
        )}
        {request.isError && !(request.error instanceof ApiError && request.error.status === 404) && (
          <LoadProblem message="Couldn't load this request." retry={() => request.refetch()} />
        )}
        {request.data && (
          <>
            <h1 className="my-0 font-display text-[28px] leading-[1.2] font-bold tracking-tight">
              <strong>{request.data.clientName}</strong> wants to use Nando
            </h1>
            <p className="my-0 text-[17px]">It will be able to search, add and change your Words, and use every other Tool Nando offers.</p>
            <p className="my-0 text-[15px] text-sub">
              Then back to <span className="font-semibold text-ink">{request.data.redirectHost}</span>
            </p>
          </>
        )}
      </div>
      {request.data && (
        <div className="flex flex-col items-center gap-2 pb-4">
          {problem && (
            <p role="alert" className="mx-4 mt-0 mb-2 text-center text-[15px] text-sub">
              {problem}
            </p>
          )}
          {/* Native buttons: Safari only lets WebAuthn start from within a tap's click. */}
          <button
            type="button"
            onClick={() => run(allow, request.data.clientName)}
            disabled={busy}
            className={pillClasses('accent', 'large')}
          >
            Allow with Face ID
          </button>
          <button
            type="button"
            onClick={() => run(deny, request.data.clientName)}
            disabled={busy}
            className="min-h-11 rounded-none bg-transparent px-4 text-[17px] font-normal text-accent">
            Don't allow
          </button>
        </div>
      )}
    </main>
  )
}

// Why `name` wasn't allowed, or why it couldn't be turned down.
function describe(error: unknown, name: string): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return `Face ID was cancelled, so ${name} wasn't allowed.`
  if (error instanceof ApiError && error.status === 401) return `This Passkey wasn't accepted, so ${name} wasn't allowed.`
  if (error instanceof ApiError && error.status === 404) return `This request has expired. Try connecting again from ${name}.`
  return "Couldn't reach Nando. Try again."
}
