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
// the mail the Owner labeled Career in Gmail (feriosch/nando-server ADR 0010). A server from before it
// answers none, and the section offers nothing.
export function CareerSettingsSection() {
  const api = useApi()
  const settings = useQuery({ queryKey: ['career', 'settings'], queryFn: () => api.get<CareerSettings>('/api/career/settings') })
  // Save sends Looking back too, so the form waits for settings loaded since the section opened: a
  // cached copy could undo a change made on another device, or on the Home Card.
  const loaded = useLoadedSinceMount(settings)
  return (
    <>
      {settings.isError && <LoadProblem message="Couldn't load the Career settings." retry={() => settings.refetch()} />}
      {loaded && settings.data?.gmailCareerSync && <GmailCareerSyncForm saved={settings.data} sync={settings.data.gmailCareerSync} />}
    </>
  )
}

function GmailCareerSyncForm({ saved, sync: savedSync }: { saved: CareerSettings; sync: GmailCareerSync }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [sync, setSync] = useState(savedSync)
  const save = useMutation({
    mutationFn: (settings: CareerSettings) => api.put('/api/career/settings', settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['career'] }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate({ looking: saved.looking, gmailCareerSync: sync })
  }

  return (
    <form onSubmit={submit} className="my-0">
      <GroupedList footer={saveFooter(save.isSuccess && 'Saved.', save.isError ? describe(save.error) : null)}>
        <ListRow className="text-[17px]">
          <Switch isSelected={sync.enabled} onChange={(enabled) => setSync({ ...sync, enabled })}>
            Gmail Career Sync
          </Switch>
        </ListRow>
        {sync.enabled && (
          <PickerRow
            label="Every day at"
            value={sync.time}
            options={reminderTimeOptions}
            onChange={(time) => setSync({ ...sync, time })}
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
