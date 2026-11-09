import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, usePasskeys } from '../services'
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
    <main>
      <h1>Nando</h1>
      <button type="button" onClick={signIn} disabled={busy}>
        Sign in with Face ID
      </button>
      {problem && <p role="alert">{problem}</p>}
      <Link to="/enroll">Use an Enrollment Code</Link>
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
