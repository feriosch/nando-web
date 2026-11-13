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
export function Consent({ toolsDescriptions }: { toolsDescriptions: string[] }) {
  const api = useApi()
  const passkeys = usePasskeys()
  const leave = useLeave()
  const [params] = useSearchParams()
  const id = params.get('request') ?? ''
  const path = `/auth/connect/${encodeURIComponent(id)}`
  const request = useQuery({
    queryKey: ['connect', id],
    queryFn: () => api.get<ConnectRequest>(path),
    enabled: id !== '',
    // Read once: a request only ever goes away, and a refetch would only find it gone.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The request went away while the Owner was deciding.
  const [expiredSince, setExpiredSince] = useState(false)

  // Runs `answer` once at a time and leaves for where it leads. A problem keeps the Owner on the
  // page with both buttons, unless the request has gone, which leaves nothing to answer.
  async function run(answer: () => Promise<string>, connectorName: string) {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      leave(await answer())
    } catch (error) {
      if (isExpired(error)) setExpiredSince(true)
      else setProblem(describe(error, connectorName))
      setBusy(false)
    }
  }

  // Approves the request with a Passkey. WebAuthn must start from a tap, so nothing is asked until
  // the Owner presses Allow. Answers where to go next: back to the Connector, with its code.
  async function allow() {
    const { publicKey } = await api.post<Begin<PublicKeyCredentialRequestOptionsJSON>>(`${path}/begin`)
    const credential = await passkeys.get(publicKey)
    return (await api.post<{ redirect: string }>(`${path}/finish`, credential)).redirect
  }

  // Turns the request down. Answers where to go next: back to the Connector, told it was denied.
  async function deny() {
    return (await api.post<{ redirect: string }>(`${path}/deny`)).redirect
  }

  const expired = id === '' || isExpired(request.error) || expiredSince
  const asking = !expired && request.data
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <img src="/icon.svg" alt="" width={72} height={72} className="size-18 rounded-[16px]" />
        {expired && <p className="my-0 text-[17px]">This request has expired. Try connecting again from Claude.</p>}
        {!expired && request.isError && <LoadProblem message="Couldn't load this request." retry={() => request.refetch()} />}
        {asking && (
          <>
            <h1 className="my-0 font-display text-[28px] leading-[1.2] font-bold tracking-tight">
              {asking.clientName} wants to use Nando
            </h1>
            <p className="my-0 text-[17px]">It will be able to {canDo(toolsDescriptions)}.</p>
            <p className="my-0 text-[15px] text-sub">
              Then back to <span className="font-semibold text-ink">{asking.redirectHost}</span>
            </p>
          </>
        )}
      </div>
      {asking && (
        <div className="flex flex-col items-center gap-2 pb-4">
          {problem && (
            <p role="alert" className="mx-4 mt-0 mb-2 text-center text-[15px] text-sub">
              {problem}
            </p>
          )}
          {/* A native button: Safari only lets WebAuthn start from within a tap's click. */}
          <button
            type="button"
            onClick={() => run(allow, asking.clientName)}
            disabled={busy}
            className={pillClasses('accent', 'large')}
          >
            Allow with Face ID
          </button>
          {/* A plain text button under the main action, as sign-in's link is; a native button so
              both answers run the same way. */}
          <button
            type="button"
            onClick={() => run(deny, asking.clientName)}
            disabled={busy}
            className="min-h-11 rounded-none bg-transparent px-4 text-[17px] font-normal text-accent"
          >
            Don't allow
          </button>
        </div>
      )}
    </main>
  )
}

// Whether `error` says the request is unknown, already answered or expired.
function isExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

// Why the Connector called `connectorName` wasn't allowed, or why it couldn't be turned down.
function describe(error: unknown, connectorName: string): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return `Face ID was cancelled, so ${connectorName} wasn't allowed.`
  // Any other refusal from the device's Passkeys, such as one already in use.
  if (error instanceof DOMException) return `Face ID didn't finish, so ${connectorName} wasn't allowed.`
  if (error instanceof ApiError && error.status === 401) return `This Passkey wasn't accepted, so ${connectorName} wasn't allowed.`
  return "Couldn't reach Nando. Try again."
}

// What a Connector can do, from what each Module says its Tools let it do, such as "search your
// Words, and log your workouts". With no Module saying, simply every Tool.
function canDo(descriptions: string[]): string {
  if (descriptions.length === 0) return 'use every Tool Nando offers'
  // A comma before each "and": a description can have its own "and", such as Japanese's.
  return descriptions.length === 1 ? descriptions[0] : `${descriptions.slice(0, -1).join(', ')}, and ${descriptions.at(-1)}`
}
