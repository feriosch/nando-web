import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, usePasskeys } from '../services'
import { pillClasses } from '../ui/pill'
import type { Begin } from './passkeys'

export function SignIn() {
  const api = useApi()
  const passkeys = usePasskeys()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // WebAuthn must start from a tap, so nothing happens until the Owner presses the button.
  async function signIn() {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      const { publicKey } = await api.post<Begin<PublicKeyCredentialRequestOptionsJSON>>('/auth/signin/begin')
      const credential = await passkeys.get(publicKey)
      await api.post('/auth/signin/finish', credential)
      navigate('/', { replace: true })
    } catch (error) {
      setProblem(describe(error))
      setBusy(false)
    }
  }

  return (
    // Fills the screen (SignedOut's frame is a flex column): the icon and name centred, the actions within thumb reach.
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <img src="/icon.svg" alt="" width={96} height={96} className="size-24 rounded-[22px]" />
        <h1 className="my-0 font-display text-[34px] leading-[1.15] font-bold tracking-tight">Nando</h1>
      </div>
      <div className="flex flex-col items-center gap-2 pb-4">
        {problem && (
          <p role="alert" className="mx-4 mt-0 mb-2 text-center text-[15px] text-sub">
            {problem}
          </p>
        )}
        {/* A native button: Safari only lets WebAuthn start from within a tap's click. */}
        <button type="button" onClick={signIn} disabled={busy} className={pillClasses('accent', 'large')}>
          Sign in with Face ID
        </button>
        <Link to="/enroll" viewTransition className="flex min-h-11 items-center px-4 text-[17px] text-accent no-underline">
          Use an Enrollment Code
        </Link>
      </div>
    </main>
  )
}

function describe(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Sign-in was cancelled.'
  }
  if (error instanceof ApiError && error.status === 401) {
    return "This Passkey wasn't accepted. If it was deleted, register a new one with an Enrollment Code."
  }
  return "Couldn't sign in."
}
