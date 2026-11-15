import { formatDayAs } from '../../core/days'

// The types below mirror nando-server's internal/career/API.md.

// Where an open Opportunity stands.
export type OpenStage = 'introduced' | 'in_process' | 'offer'

export type Interest = 'high' | 'normal' | 'low'

// An Opportunity's next Step, as the app's lists show it. `time` is "HH:MM", or null when unknown.
export type NextStep = { kind: string; date: string; time: string | null }

// An open Opportunity as the app's lists show it, top first.
export type TopOpportunity = {
  id: string
  company: { id: string; name: string }
  role: string
  stage: OpenStage
  interest: Interest
  nextStep: NextStep | null
}

// What GET /api/career/home-card answers.
export type CareerHomeCard = {
  looking: boolean
  waiting: number
  top: TopOpportunity[]
}

const stageNames: Record<OpenStage, string> = { introduced: 'Introduced', in_process: 'In Process', offer: 'Offer' }

// The Stage for the Owner to read, such as "In Process".
export function stageName(stage: OpenStage): string {
  return stageNames[stage]
}

// A next Step for the Owner to read, such as "Final interview · Fri 27 Nov, 18:00".
export function describeStep({ kind, date, time }: NextStep): string {
  const day = formatDayAs(date, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${kind} · ${time === null ? day : `${day}, ${time}`}`
}
