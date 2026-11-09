import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, usePasskeys } from '../services'

type Begin = { publicKey: PublicKeyCredentialCreationOptionsJSON }

// Registers a new Passkey with an Enrollment Code from `nando-server enroll`.
export function Enroll() {
  const api = useApi()
  const passkeys = usePasskeys()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  // Submitting is the tap WebAuthn must start from.
  async function enroll(event: FormEvent) {
    event.preventDefault()
    setProblem(null)
    try {
      const { publicKey } = await api.post<Begin>('/auth/register/begin', { code })
      const credential = await passkeys.create(publicKey)
      await api.post('/auth/register/finish', credential)
      navigate('/', { replace: true })
    } catch (error) {
      setProblem(describe(error))
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
        <button type="submit">Create Passkey</button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      <Link to="/sign-in">Sign in with Face ID</Link>
    </main>
  )
}

function describe(error: unknown): string {
  // The server's options exclude the Owner's Passkeys, so the device refuses to register a second one.
  if (error instanceof DOMException && error.name === 'InvalidStateError') {
    return 'This device already has a Passkey for Nando. Sign in with it instead.'
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'That Enrollment Code is unknown, used or expired. Run nando-server enroll for a new one.'
  }
  return "Couldn't register the Passkey."
}
