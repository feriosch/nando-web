import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useApi } from '../../core/services'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { Button } from '../../core/ui/Button'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, SectionHeader } from '../../core/ui/List'
import { EmptyNote } from '../../core/ui/Notice'
import { saveFooter } from '../../core/ui/saveFooter'
import { HeaderLink, ScreenHeader } from '../../core/ui/ScreenHeader'
import { kcal, type Meal } from './calories'
import { rowLinkClasses, Tile } from './rows'
import { restoreProblem, useRestore } from './useRestore'

// The Meals screen: every Meal in use, by name, each opening the Meal form; then the archived ones.
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
      <ScreenHeader
        title="Meals"
        subtitle={meals.data && archived.data && countLine(meals.data.length, archived.data.length)}
        back={{ to: '/calories', label: 'Today' }}
        actions={<HeaderLink to="new">New Meal</HeaderLink>}
      />
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
        <>
          <SectionHeader id="calories-in-use">In use</SectionHeader>
          {meals.data.length === 0 ? (
            <EmptyNote>No Meals yet. A new one goes in the quick list.</EmptyNote>
          ) : (
            <GroupedList as="ul" labelledBy="calories-in-use">
              {meals.data.map((meal) => (
                <li key={meal.id}>
                  <Link to={meal.id} viewTransition className={rowLinkClasses}>
                    <MealLine meal={meal} />
                    <span className="shrink-0 tabular-nums">
                      <span className="sr-only">, </span>
                      {kcal(meal.kcal)} kcal
                    </span>
                    <ChevronRight {...lucideProps} className="-mr-1.5 size-5 shrink-0 text-sub" />
                  </Link>
                </li>
              ))}
            </GroupedList>
          )}
        </>
      )}
      {archived.data && archived.data.length > 0 && (
        <>
          <SectionHeader id="calories-archived">Archived</SectionHeader>
          <GroupedList
            as="ul"
            labelledBy="calories-archived"
            footer={saveFooter(false, restore.isError ? restoreProblem : null)}
          >
            {archived.data.map((meal) => (
              // The row opens the Meal form, all but its Restore pill, which can't sit inside a link.
              <li key={meal.id} className="flex items-center pr-4">
                <Link to={meal.id} viewTransition className={`${rowLinkClasses} min-w-0 flex-1`}>
                  <MealLine meal={meal} kcalInMeta />
                </Link>
                <Button aria-label={`Restore ${meal.name}`} onPress={() => restore.mutate(meal.id)} className="shrink-0">
                  Restore
                </Button>
              </li>
            ))}
          </GroupedList>
        </>
      )}
    </>
  )
}

// The line under the title, such as "5 Meals · 1 archived".
function countLine(inUse: number, archived: number): string {
  const meals = `${inUse} ${inUse === 1 ? 'Meal' : 'Meals'}`
  return archived > 0 ? `${meals} · ${archived} archived` : meals
}

// A Meal's tile (its photo, else its emoji), its name, " · Pinned" if it is, and under them its store
// and Tags, such as "7-Eleven · snack, conbini" (after its kcal with `kcalInMeta`, for a row with no
// room for it on the right). Long names and stores,
// Japanese ones too, end in an ellipsis.
function MealLine({ meal, kcalInMeta = false }: { meal: Meal; kcalInMeta?: boolean }) {
  const meta = [kcalInMeta && `${kcal(meal.kcal)} kcal`, meal.store, meal.tags.join(', ')].filter(Boolean).join(' · ')
  return (
    <>
      <Tile image={meal.imageUrl}>{meal.emoji}</Tile>
      <span className="min-w-0 flex-1">
        <span className="flex leading-snug">
          <span lang="ja" className="truncate">
            {meal.name}
          </span>
          {meal.pinned && <span className="shrink-0 whitespace-pre text-sub"> · Pinned</span>}
        </span>
        {meta && (
          <span lang="ja" className="block truncate text-[13px] text-sub">
            <span className="sr-only">, </span>
            {meta}
          </span>
        )}
      </span>
    </>
  )
}
