import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, usePasskeys } from '../services'
import type { Begin } from './passkeys'

// Registers a new Passkey with an Enrollment Code from `nando-server enroll`.
export function Enroll() {
  const api = useApi()
  const passkeys = usePasskeys()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Submitting is the tap WebAuthn must start from.
  async function enroll(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setProblem(null)
    let codeAccepted = false
    try {
      // Codes are printed in uppercase; forgive a pasted space or lowercase typing.
      const { publicKey } = await api.post<Begin<PublicKeyCredentialCreationOptionsJSON>>(
        '/auth/register/begin',
        { code: code.trim().toUpperCase() },
      )
      codeAccepted = true
      const credential = await passkeys.create(publicKey)
      await api.post('/auth/register/finish', credential)
      navigate('/', { replace: true })
    } catch (error) {
      setProblem(describe(error, codeAccepted))
      setBusy(false)
    }
  }

  return (
    <main>
      <h1>Register a Passkey</h1>
      <form onSubmit={enroll}>
        <label>
          Enrollment Code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" disabled={busy}>
          Create Passkey
        </button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      <Link to="/sign-in">Sign in with Face ID</Link>
    </main>
  )
}

function describe(error: unknown, codeAccepted: boolean): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Registering the Passkey was cancelled.'
  }
  // The server's options exclude the Owner's Passkeys, so the device refuses to register a second one.
  if (error instanceof DOMException && error.name === 'InvalidStateError') {
    return 'This device already has a Passkey for Nando. Sign in with it instead.'
  }
  if (error instanceof ApiError && error.status === 401) {
    return codeAccepted
      ? "Nando couldn't register this Passkey, or the Enrollment Code expired in the meantime."
      : 'That Enrollment Code is unknown, used or expired. Run nando-server enroll for a new one.'
  }
  return "Couldn't register the Passkey."
}
