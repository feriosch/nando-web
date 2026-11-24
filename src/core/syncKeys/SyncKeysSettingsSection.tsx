import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { ApiError } from '../api/client'
import { addDays, dayOf, formatDayShort } from '../days'
import type { Begin } from '../identity/passkeys'
import { useApi, useClipboard, usePasskeys } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import { useToday } from '../today'
import { Button } from '../ui/Button'
import { FieldRow } from '../ui/FieldRow'
import { GroupedList, ListRow } from '../ui/List'
import { EmptyNote } from '../ui/Notice'
import { pillClasses } from '../ui/pill'
import { saveFooter } from '../ui/saveFooter'
import { Sheet } from '../ui/Sheet'
import { useLastShown } from '../ui/useLastShown'

// A Sync Key, as GET /api/sync-keys answers it: a key one of the Owner's own automations, such as the
// Health Sync Shortcut, calls Nando with (ADR 0015). Its key itself is answered only once, on creation.
type SyncKey = { id: string; name: string; createdAt: string; lastUsedAt: string | null }
type CreatedSyncKey = SyncKey & { key: string }

// Core's Sync Keys Settings Section: each Sync Key, when it was created and last used, removing one,
// which asks first, and creating one with Face ID, whose key is shown once to copy.
export function SyncKeysSettingsSection() {
  const api = useApi()
  const queryClient = useQueryClient()
  const { today, settings } = useToday()
  const keys = useQuery({ queryKey: ['sync-keys'], queryFn: () => api.get<SyncKey[]>('/api/sync-keys') })
  const [removing, setRemoving] = useState<SyncKey | null>(null)
  const shownRemoving = useLastShown(removing)
  const remove = useMutation({
    mutationFn: (key: SyncKey) => api.delete(`/api/sync-keys/${encodeURIComponent(key.id)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['sync-keys'] }),
  })
  const listId = useId()

  if (keys.isError || settings.isError) {
    return (
      <LoadProblem
        message="Couldn't load the Sync Keys."
        retry={() => {
          if (settings.isError) settings.refetch()
          if (keys.isError) keys.refetch()
        }}
      />
    )
  }
  if (!keys.data || !today || !settings.data) return null
  const timeZone = settings.data.timeZone
  return (
    <>
      {keys.data.length === 0 ? (
        <EmptyNote>
          Sync Keys let your own automations, such as the Health Sync Shortcut, send Nando your steps. Each reaches only what
          it's made for, and you can remove it here at any time.
        </EmptyNote>
      ) : (
        <>
          <span id={listId} className="sr-only">
            Sync Keys
          </span>
          <GroupedList
            as="ul"
            labelledBy={listId}
            footer={saveFooter(false, remove.isError ? `Couldn't remove ${remove.variables.name}.` : null)}
          >
            {keys.data.map((key) => (
              <ListRow as="li" key={key.id}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px]">{key.name}</span>
                  <span className="block text-[15px] text-sub">
                    Created {relativeDay(dayOf(new Date(key.createdAt), timeZone), today)} ·{' '}
                    {key.lastUsedAt === null ? 'Never used' : `Last used ${relativeDay(dayOf(new Date(key.lastUsedAt), timeZone), today)}`}
                  </span>
                </span>
                <Button aria-label={`Remove ${key.name}`} onPress={() => setRemoving(key)}>
                  Remove
                </Button>
              </ListRow>
            ))}
          </GroupedList>
        </>
      )}
      <NewSyncKey />
      <Sheet
        isOpen={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${shownRemoving?.name ?? ''}?`}
        role="alertdialog"
      >
        {shownRemoving && (
          <>
            <p className="mt-0 mb-5 text-[17px]">Automations using it will stop syncing.</p>
            <div className="flex gap-3">
              <Button className="flex-1" onPress={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onPress={() => {
                  if (!removing) return
                  remove.mutate(removing)
                  setRemoving(null)
                }}
              >
                Remove
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}

// Creating a Sync Key: its name, then Face ID, then its key in a sheet, shown only this once.
function NewSyncKey() {
  const api = useApi()
  const passkeys = usePasskeys()
  const clipboard = useClipboard()
  const queryClient = useQueryClient()
  const [name, setName] = useState('iPhone Health')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedSyncKey | null>(null)
  const shownCreated = useLastShown(created)
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')

  // WebAuthn must start from a tap, so nothing is asked until the Owner presses the button.
  async function create() {
    if (busy) return
    setBusy(true)
    setProblem(null)
    // Only `begin` checks the name, so only its 400 is about the name.
    let step: 'begin' | 'finish' = 'begin'
    try {
      const { publicKey } = await api.post<Begin<PublicKeyCredentialRequestOptionsJSON>>('/api/sync-keys/begin', { name })
      step = 'finish'
      const credential = await passkeys.get(publicKey)
      setCopy('idle')
      setCreated(await api.post<CreatedSyncKey>('/api/sync-keys/finish', credential))
      queryClient.invalidateQueries({ queryKey: ['sync-keys'] })
    } catch (error) {
      setProblem(describe(error, step))
    }
    setBusy(false)
  }

  return (
    <>
      <GroupedList footer={saveFooter(false, problem)}>
        <FieldRow label="Name" value={name} onChange={setName} maxLength={50} />
      </GroupedList>
      <div className="mt-3">
        {/* A native button: Safari only lets WebAuthn start from within a tap's click. */}
        <button
          type="button"
          onClick={create}
          disabled={busy || name.trim() === ''}
          className={pillClasses('quiet', 'large')}
        >
          Create with Face ID
        </button>
      </div>
      {/* Not dismissable: a stray tap on the scrim would lose the key, which is never shown again. */}
      <Sheet
        isOpen={created !== null}
        onOpenChange={(open) => !open && setCreated(null)}
        title={shownCreated?.name ?? ''}
        dismissable={false}
      >
        {shownCreated && (
          <>
            <p className="mt-0 mb-3 text-[17px]">Copy this key into the Shortcut. Nando shows it only now.</p>
            <p className="mt-0 mb-4 rounded-[14px] bg-bg px-4 py-3 font-mono text-[15px] break-all select-all">{shownCreated.key}</p>
            <div className="flex items-center gap-3">
              <Button
                variant="accent"
                onPress={() => clipboard.copy(shownCreated.key).then(() => setCopy('copied'), () => setCopy('failed'))}
              >
                Copy
              </Button>
              <span role="status" className="text-[15px] text-sub">
                {copy === 'copied' && 'Copied'}
              </span>
              <Button className="ml-auto" onPress={() => setCreated(null)}>
                Done
              </Button>
            </div>
            {copy === 'failed' && (
              <p role="alert" className="mt-2 mb-0 text-[13px] text-sub">
                Couldn't copy. Select the key and copy it instead.
              </p>
            )}
          </>
        )}
      </Sheet>
    </>
  )
}

// Why no Sync Key was created.
function describe(error: unknown, step: 'begin' | 'finish'): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Face ID was cancelled, so no Sync Key was created.'
  if (error instanceof DOMException) return "Face ID didn't finish, so no Sync Key was created."
  // 403, not 401: a 401 under /api/ means the Session is gone, and signs the Owner out.
  if (error instanceof ApiError && error.status === 403) return "This Passkey wasn't accepted, or Face ID took too long, so no Sync Key was created."
  if (error instanceof ApiError && error.status === 400 && step === 'begin') return 'Give the Sync Key a name of up to 50 characters.'
  return "Couldn't reach Nando. Try again."
}

// A day as the Owner thinks of it: "today", "yesterday", or its date.
function relativeDay(day: string, today: string): string {
  if (day === today) return 'today'
  if (day === addDays(today, -1)) return 'yesterday'
  return formatDayShort(day, today)
}
