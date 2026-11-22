import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../core/api/client'
import { useLoadedSinceMount } from '../../core/api/loaded'
import { useApi } from '../../core/services'
import { reminderTimeOptions } from '../../core/settings/settings'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { Button } from '../../core/ui/Button'
import { GroupedList, ListRow } from '../../core/ui/List'
import { PickerRow } from '../../core/ui/Picker'
import { saveFooter } from '../../core/ui/saveFooter'
import { Switch } from '../../core/ui/Switch'
import type { CareerSettings, GmailCareerSync } from './career'

// The Career Settings Section: the Gmail Career Sync, the daily ask for the Career Assistant to file
// the mail labeled Career/Recruiters in Gmail, which the Core Assistant applies in the Gmail Digest's
// run (feriosch/nando-server ADR 0010, ADR 0011). A server from before it
// answers none, and the section offers nothing.
export function CareerSettingsSection() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['career', 'settings'], queryFn: () => api.get<CareerSettings>('/api/career/settings') })
  // The form waits for settings loaded since the section opened, so it starts from what the server
  // has, not a cached copy.
  const loaded = useLoadedSinceMount(settings)
  return (
    <>
      {settings.isError && <LoadProblem message="Couldn't load the Career settings." retry={() => settings.refetch()} />}
      {loaded && settings.data?.gmailCareerSync && <GmailCareerSyncForm sync={settings.data.gmailCareerSync} />}
    </>
  )
}

function GmailCareerSyncForm({ sync: savedSync }: { sync: GmailCareerSync }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [sync, setSync] = useState(savedSync)
  const save = useMutation({
    // The PUT carries Looking too, so it's read again first: the Home Card may have changed it, here
    // or on another device, since the section opened.
    mutationFn: async (gmailCareerSync: GmailCareerSync) => {
      const { looking } = await api.get<CareerSettings>('/api/career/settings')
      return api.put('/api/career/settings', { looking, gmailCareerSync } satisfies CareerSettings)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['career'] }),
  })

  // A change after a save takes away its "Saved.", which no longer describes the form.
  function edit(next: GmailCareerSync) {
    save.reset()
    setSync(next)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(sync)
  }

  // The Gmail Digest's run files the night's mail, Recruiters' included, so the Sync comes after it.
  const hint = sync.enabled && <p className="my-0">Set it after your Gmail Digest, which files the night's mail.</p>
  const status = saveFooter(save.isSuccess && 'Saved.', save.isError ? describe(save.error) : null)

  return (
    <form onSubmit={submit} className="my-0">
      <GroupedList
        footer={
          (hint || status) && (
            <>
              {hint}
              {status}
            </>
          )
        }
      >
        <ListRow className="text-[17px]">
          <Switch isSelected={sync.enabled} onChange={(enabled) => edit({ ...sync, enabled })}>
            Gmail Career Sync
          </Switch>
        </ListRow>
        {sync.enabled && (
          <PickerRow
            label="Every day at"
            value={sync.time}
            options={reminderTimeOptions}
            onChange={(time) => edit({ ...sync, time })}
            display={<span className="tabular-nums">{sync.time}</span>}
          />
        )}
      </GroupedList>
      <div className="mt-3 flex justify-end">
        <Button type="submit" variant="accent">
          Save
        </Button>
      </div>
    </form>
  )
}

function describe(error: unknown): string {
  // A 400's message says which setting the server refused.
  if (error instanceof ApiError && error.status === 400 && error.detail) {
    return `Couldn't save the Career settings: ${error.detail}`
  }
  return "Couldn't save the Career settings."
}
