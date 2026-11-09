import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useApi } from '../services'
import type { Body } from './body'

// The Body Home Card: the latest Weigh-in, its BMI and the change since the week before.
export function BodyCard() {
  const api = useApi()
  const body = useQuery({ queryKey: ['body'], queryFn: () => api.get<Body>('/api/body') })

  return (
    <>
      <h2>Body</h2>
      {body.data?.latest && (
        <>
          <p>{body.data.latest.kg.toFixed(1)} kg</p>
          {body.data.bmi !== null ? (
            <p>BMI {body.data.bmi.toFixed(1)}</p>
          ) : (
            <p>
              <Link to="/settings">Set your height for BMI</Link>
            </p>
          )}
          {body.data.change !== null && <p>{signed(body.data.change)} kg vs the week before</p>}
          <p>
            <Link to="/weigh-ins">Weigh-ins</Link>
          </p>
        </>
      )}
      {body.data && !body.data.latest && (
        <>
          <p>No Weigh-ins yet.</p>
          <p>
            <Link to="/weigh-ins">Log a Weigh-in</Link>
          </p>
        </>
      )}
    </>
  )
}

// A change in kg with its sign, using a real minus sign.
function signed(kg: number): string {
  const text = Math.abs(kg).toFixed(1)
  if (kg > 0) return `+${text}`
  if (kg < 0) return `−${text}`
  return text
}
