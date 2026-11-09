import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { kcal, mealName, type Meal } from './calories'
import { useRestore } from './useRestore'

// The Meals screen: every Meal in use, by name.
export function Meals() {
  const api = useApi()
  const meals = useQuery({ queryKey: ['calories', 'meals', 'in-use'], queryFn: () => api.get<Meal[]>('/api/calories/meals') })
  const archived = useQuery({
    queryKey: ['calories', 'meals', 'archived'],
    queryFn: () => api.get<Meal[]>('/api/calories/meals?archived=true'),
  })
  const restore = useRestore()

  return (
    <>
      <h1>Meals</h1>
      <p>
        <Link to="new">New Meal</Link>
      </p>
      {(meals.isError || archived.isError) && (
        <LoadProblem
          message="Couldn't load your Meals."
          retry={() => {
            if (meals.isError) meals.refetch()
            if (archived.isError) archived.refetch()
          }}
        />
      )}
      {meals.data && (
        <ul aria-label="Meals">
          {meals.data.map((meal) => (
            <MealItem key={meal.id} meal={meal} />
          ))}
        </ul>
      )}
      {archived.data && archived.data.length > 0 && (
        <>
          <h2 id="calories-archived">Archived</h2>
          <ul aria-labelledby="calories-archived">
            {archived.data.map((meal) => (
              <li key={meal.id}>
                <Link to={meal.id}>{mealName(meal)}</Link>{' '}
                <button type="button" onClick={() => restore.mutate(meal.id)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
          {restore.isError && <p role="alert">Couldn't restore the Meal.</p>}
        </>
      )}
    </>
  )
}

function MealItem({ meal }: { meal: Meal }) {
  return (
    <li>
      {meal.imageUrl && <img src={meal.imageUrl} alt={meal.name} width={64} height={64} style={{ display: 'block', objectFit: 'cover', borderRadius: 8 }} />}
      <Link to={meal.id}>{mealName(meal)}</Link> {kcal(meal.kcal)} kcal
      {meal.pinned && ' · Pinned'}
      {meal.store && <div>{meal.store}</div>}
      {meal.tags.length > 0 && <div>{meal.tags.join(', ')}</div>}
    </li>
  )
}

