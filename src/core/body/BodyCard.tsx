import { useQuery } from '@tanstack/react-query'
import { Weight } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useApi } from '../services'
import { LoadProblem } from '../shell/LoadProblem'
import { useToday } from '../today'
import { CardHeader, CardLink, cardClasses } from '../ui/HomeCard'
import { lucideProps } from '../ui/icons'
import type { Body } from './body'
import { formatWeekShort } from './weeks'

// The Body Home Card: the latest Weigh-in, its BMI and the change since the week before. Once
// loaded, the whole card opens Weigh-ins.
export function BodyCard() {
  const api = useApi()
  const body = useQuery({ queryKey: ['body'], queryFn: () => api.get<Body>('/api/body') })
  const latest = body.data?.latest
  // Today in the Owner Time Zone, for whether the latest Weigh-in's week needs its year.
  const { today } = useToday()

  return (
    <div className={`${cardClasses} bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]`}>
      <CardHeader icon={<Weight {...lucideProps} />} chevron={body.data !== undefined}>
        Body
      </CardHeader>
      {body.isError && (
        // Above the card's link, which stays while a reload of loaded data fails.
        <div className="relative z-10">
          <LoadProblem message="Couldn't load your Weigh-ins." retry={() => body.refetch()} />
        </div>
      )}
      {body.data && latest && (
        <>
          <p className="mt-2 mb-0 text-[30px] leading-tight font-bold tabular-nums">{latest.kg.toFixed(1)} kg</p>
          <Details>
            <span>Week of {formatWeekShort(latest.week, today)}</span>
            {body.data.bmi !== null ? (
              <span>BMI {body.data.bmi.toFixed(1)}</span>
            ) : (
              // A tap target 44px tall around the 13px line, above the card's own link.
              <Link
                to="/settings"
                viewTransition
                className="relative z-10 text-accent no-underline before:absolute before:-inset-x-1 before:-inset-y-[14px] before:content-['']"
              >
                Set your height for BMI
              </Link>
            )}
            {body.data.change !== null && <span>{signed(body.data.change)} kg vs the week before</span>}
          </Details>
          <CardLink to="/weigh-ins">
            <span className="sr-only">Weigh-ins</span>
          </CardLink>
        </>
      )}
      {body.data && !latest && (
        <>
          <p className="mt-2 mb-0 text-[17px]">No Weigh-ins yet.</p>
          <p className="mt-1 mb-0 text-[15px]">
            <CardLink to="/weigh-ins" className="text-accent no-underline">
              Log a Weigh-in
            </CardLink>
          </p>
        </>
      )}
    </div>
  )
}

// The card's one line of details under the weight, its parts separated by middle dots.
function Details({ children }: { children: ReactNode[] }) {
  const parts = children.filter(Boolean)
  return (
    <p className="mt-1 mb-0 text-[13px] text-pretty text-sub tabular-nums">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {part}
        </Fragment>
      ))}
    </p>
  )
}

// A change in kg with its sign, using a real minus sign.
function signed(kg: number): string {
  const text = Math.abs(kg).toFixed(1)
  if (kg > 0) return `+${text}`
  if (kg < 0) return `−${text}`
  return text
}
