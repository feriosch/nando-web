import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { apiBaseUrl } from '../config'
import { addDays, dayOf, formatDayShort } from '../days'
import { useApi } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import { useToday } from '../today'
import { Button } from '../ui/Button'
import { GroupedList, ListRow } from '../ui/List'
import { EmptyNote } from '../ui/Notice'
import { saveFooter } from '../ui/saveFooter'
import { Sheet } from '../ui/Sheet'
import { useLastShown } from '../ui/useLastShown'

// A Connector, as GET /api/connectors answers it: an app the Owner let use Nando's Tools.
type Connector = { id: string; name: string; approvedAt: string; lastUsedAt: string | null }

// Core's Connectors Settings Section: each Connector, when it was approved and last used, and
// removing one, which asks first.
export function ConnectorsSettingsSection() {
  const api = useApi()
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<Connector | null>(null)
  const shownRemoving = useLastShown(removing)
  const remove = useMutation({
    mutationFn: (connector: Connector) => api.delete(`/api/connectors/${encodeURIComponent(connector.id)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['connectors'] }),
  })
  const { today, settings } = useToday()
  const connectors = useQuery({ queryKey: ['connectors'], queryFn: () => api.get<Connector[]>('/api/connectors') })
  const listId = useId()

  if (connectors.isError || settings.isError) {
    return (
      <LoadProblem
        message="Couldn't load the Connectors."
        retry={() => {
          if (settings.isError) settings.refetch()
          if (connectors.isError) connectors.refetch()
        }}
      />
    )
  }
  if (!connectors.data || !today || !settings.data) return null
  const timeZone = settings.data.timeZone
  if (connectors.data.length === 0) {
    return (
      <EmptyNote>
        No Connectors yet. To add one, add a custom connector in the Claude app with{' '}
        {/* On a line of its own, and copied whole with a tap, without the full stop. */}
        <span className="block">
          <span className="font-medium text-ink select-all">{apiBaseUrl}/mcp</span>.
        </span>
      </EmptyNote>
    )
  }
  return (
    <>
      <span id={listId} className="sr-only">
        Connectors
      </span>
      <GroupedList
        as="ul"
        labelledBy={listId}
        footer={saveFooter(false, remove.isError ? `Couldn't remove ${remove.variables.name}.` : null)}
      >
        {connectors.data.map((connector) => (
          <ListRow as="li" key={connector.id}>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px]">{connector.name}</span>
              <span className="block text-[15px] text-sub">
                Approved {formatDayShort(dayOf(new Date(connector.approvedAt), timeZone), today)} ·{' '}
                {connector.lastUsedAt === null ? 'Never used' : `Last used ${lastUsed(dayOf(new Date(connector.lastUsedAt), timeZone), today)}`}
              </span>
            </span>
            <Button aria-label={`Remove ${connector.name}`} onPress={() => setRemoving(connector)}>
              Remove
            </Button>
          </ListRow>
        ))}
      </GroupedList>
      <Sheet
        isOpen={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${shownRemoving?.name ?? ''}?`}
        role="alertdialog"
      >
        {shownRemoving && (
          <>
            <p className="mt-0 mb-5 text-[17px]">{shownRemoving.name} will lose access to Nando until you connect it again.</p>
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

// When a Connector was last used: "today", "yesterday", or its day.
function lastUsed(day: string, today: string): string {
  if (day === today) return 'today'
  if (day === addDays(today, -1)) return 'yesterday'
  return formatDayShort(day, today)
}
