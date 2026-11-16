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

// Where an Opportunity stands, open or closed.
export type Stage = OpenStage | 'closed'

const stageNames: Record<Stage, string> = { introduced: 'Introduced', in_process: 'In Process', offer: 'Offer', closed: 'Closed' }

// The Stage for the Owner to read, such as "In Process".
export function stageName(stage: Stage): string {
  return stageNames[stage]
}

const interestNames: Record<Interest, string> = { high: 'High interest', normal: 'Normal interest', low: 'Low interest' }

// The Interest for the Owner to read, such as "High interest".
export function interestName(interest: Interest): string {
  return interestNames[interest]
}

// When a Step is, for the Owner to read: "Fri 27 Nov, 18:00", with the year when it isn't the year
// `today` is in: "Fri 8 Jan 2027". Without `today`, it leaves the year out.
export function stepWhen(date: string, time: string | null, today: string | undefined): string {
  const otherYear = today !== undefined && date.slice(0, 4) !== today.slice(0, 4)
  const day = `${formatDayAs(date, { weekday: 'short' })} ${formatDayAs(date, { day: 'numeric', month: 'short', ...(otherYear && { year: 'numeric' }) })}`
  return time === null ? day : `${day}, ${time}`
}

// A next Step for the Owner to read, such as "Final interview · Fri 27 Nov, 18:00".
export function describeStep({ kind, date, time }: NextStep, today: string | undefined): string {
  return `${kind} · ${stepWhen(date, time, today)}`
}

// What a link to the Opportunity is called, read as one phrase: "Backend Engineer at Kumo Pay,
// In Process, next: Final interview · Fri 27 Nov, 18:00".
export function opportunityLabel(o: TopOpportunity, step: string | null): string {
  return `${o.role} at ${o.company.name}, ${stageName(o.stage)}${step ? `, next: ${step}` : ''}`
}

// A Recruiter waiting for the Owner's answer, follow-up or Late Reply, as the Career screen and Late
// Replies list them. `lastMessageAt` is when the Recruiter's last message came; `firstLine` is the
// first line of the Suggested Reply.
export type WaitingRecruiter = {
  id: string
  name: string
  organisation: string
  lastMessageAt: string
  firstLine: string
}

// What GET /api/career answers.
export type CareerOverview = {
  waiting: WaitingRecruiter[]
  top: TopOpportunity[]
  open: number
  lateReplies: number
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60],
  ['month', 30 * 24 * 60],
  ['week', 7 * 24 * 60],
  ['day', 24 * 60],
  ['hour', 60],
  ['minute', 1],
]

// How long ago `at` was, from `now`, such as "3 hours ago", "yesterday" or "2 weeks ago".
export function ago(at: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(at).getTime()) / 60_000)
  const format = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (minutes >= size) return format.format(-Math.floor(minutes / size), unit)
  }
  return 'just now'
}

// One message in a Conversation: the Owner's (`owner`) or the Recruiter's (`other`).
export type Message = { id: string; from: 'owner' | 'other'; sentAt: string; text: string }

// A mistake in the Owner's last message: what they wrote, what is natural, and why.
export type LanguageNote = { wrote: string; natural: string; why: string }

// Claude's draft of the Owner's next message, which only the Owner ever sends.
export type SuggestedReply = {
  text: string
  language: 'ja' | 'en'
  kind: 'answer' | 'follow_up' | 'late'
  notes: LanguageNote[]
}

// A Conversation as its Recruiter's page shows it: its LinkedIn URL, its last 5 messages, oldest
// first, and its Suggested Reply.
export type RecruiterConversation = {
  id: string
  url: string
  messages: Message[]
  suggestedReply: SuggestedReply | null
}

// What GET /api/career/recruiters/{id} answers: the Recruiter and their Conversations, newest first.
export type RecruiterWithConversations = {
  id: string
  name: string
  profileUrl: string
  kind: 'agency' | 'in_house'
  organisation: string
  conversations: RecruiterConversation[]
}

// "ja" when `text` has Japanese in it (kana, kanji, Japanese punctuation or full-width and
// half-width forms), so iOS picks Japanese glyphs for it.
export function langOf(text: string): 'ja' | undefined {
  return /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(text) ? 'ja' : undefined
}

// How a closed Opportunity ended.
export type Outcome = 'accepted' | 'declined' | 'withdrawn' | 'rejected' | 'faded'

// The language an Opportunity's team works in.
export type WorkingLanguage = 'ja' | 'en' | 'mixed'

// One dated event in an Opportunity's process, as its page shows it: `next` marks the next one.
// `time` is "HH:MM", or null.
export type Step = { id: string; kind: string; date: string; time: string | null; notes: string; next: boolean }

// An annual salary range in JPY.
export type Salary = { min: number; max: number }

// An Opportunity's pay: its salary as first stated and as offered, and whether bonus is included,
// each null when unknown.
export type Pay = { firstStated: Salary | null; offered: Salary | null; bonusIncluded: boolean | null }

// An Opportunity's working conditions: where the work is done, how many days a week a hybrid role
// is in the office, the office location ("" when unknown) and the working language.
export type Conditions = {
  remote: 'remote' | 'hybrid' | 'office' | null
  officeDays: number | null
  officeLocation: string
  workingLanguage: WorkingLanguage | null
}

// What GET /api/career/opportunities/{id} answers: everything about an Opportunity, open or closed.
export type OpportunityDetails = {
  id: string
  role: string
  stage: Stage
  outcome: Outcome | null
  interest: Interest
  fitNote: string
  details: string
  pay: Pay
  conditions: Conditions
  perks: string[]
  steps: Step[]
  recruiter: { id: string; name: string } | null
  company: { id: string; name: string; linkedInUrl: string; websiteUrl: string; brief: string }
}

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

// A salary range written with `amount`, low to high, joined by `dash`, or as one amount when both
// ends read the same.
function range({ min, max }: Salary, amount: (yen: number) => string, dash: string): string {
  const [low, high] = [amount(Math.min(min, max)), amount(Math.max(min, max))]
  return low === high ? low : `${low}${dash}${high}`
}

// An annual salary in 万円, such as "900–1,200万円", or "1,150万円" when it is one amount. An amount
// that isn't a whole 万 keeps one decimal: "925.5万円".
export function salaryInMan(salary: Salary): string {
  return `${range(salary, (yen) => grouped.format(yen / 10_000), '–')}万円`
}

// The same salary in yen, such as "¥9,000,000 – ¥12,000,000".
export function salaryInYen(salary: Salary): string {
  return range(salary, (yen) => `¥${grouped.format(yen)}`, ' – ')
}

// Where the work is done, such as "Hybrid, 2 days a week in the office", or null when unknown.
export function workplaceName({ remote, officeDays }: Conditions): string | null {
  switch (remote) {
    case 'remote':
      return 'Remote'
    case 'office':
      return 'In the office'
    case 'hybrid':
      return !officeDays ? 'Hybrid' : `Hybrid, ${officeDays} ${officeDays === 1 ? 'day' : 'days'} a week in the office`
    case null:
      return null
  }
}

const workingLanguageNames: Record<WorkingLanguage, string> = { ja: 'Japanese', en: 'English', mixed: 'Japanese and English' }

// The working language for the Owner to read, such as "Japanese and English".
export function workingLanguageName(language: WorkingLanguage): string {
  return workingLanguageNames[language]
}

const outcomeNames: Record<Outcome, string> = { accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn', rejected: 'Rejected', faded: 'Faded' }

// The Stage, with how it ended when it is closed: "In Process", "Closed · Declined".
export function stageWithOutcome({ stage, outcome }: Pick<OpportunityDetails, 'stage' | 'outcome'>): string {
  return stage === 'closed' && outcome !== null ? `${stageName(stage)} · ${outcomeNames[outcome]}` : stageName(stage)
}

// Where an Opportunity's page keeps what GET /api/career/opportunities/{id} answered, so another
// screen can read it.
export function opportunityKey(id: string | undefined) {
  return ['career', 'opportunities', id] as const
}
