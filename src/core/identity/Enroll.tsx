import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, usePasskeys } from '../services'
import { GroupedList, ListRow } from '../ui/List'
import { pillClasses } from '../ui/pill'
import { saveFooter } from '../ui/saveFooter'
import { ScreenHeader } from '../ui/ScreenHeader'
import type { Begin } from './passkeys'

// Registers a new Passkey with an Enrollment Code from `nando-server enroll`.
export function Enroll() {
  const api = useApi()
  const passkeys = usePasskeys()
  const navigate = useNavigate()
  const fieldId = useId()
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
      <ScreenHeader
        title="Enroll"
        subtitle="Register a Passkey with a code from nando-server enroll."
        back={{ to: '/sign-in', label: 'Sign in with Face ID' }}
      />
      <form onSubmit={enroll} className="mt-4">
        <GroupedList footer={saveFooter(false, problem)}>
          <ListRow>
            <label htmlFor={fieldId} className="my-0 shrink-0 text-[17px]">
              Enrollment Code
            </label>
            <input
              id={fieldId}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXXX-XXXXX"
              className="m-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-[17px] tracking-wide outline-none placeholder:text-sub/60"
            />
          </ListRow>
        </GroupedList>
        {/* A native submit button: submitting is the tap WebAuthn must start from. */}
        <button type="submit" disabled={busy} className={`${pillClasses('accent')} mt-6 h-[50px] w-full text-[17px]`}>
          Create Passkey
        </button>
      </form>
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
