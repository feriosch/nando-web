import { ChevronRight, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton, Group, Input, NumberField } from 'react-aria-components'
import { LoadProblem } from '../../core/shell/LoadProblem'
import { Button } from '../../core/ui/Button'
import { lucideProps } from '../../core/ui/icons'
import { GroupedList, ListRow, SectionHeader } from '../../core/ui/List'
import { kcal, type Meal } from './calories'
import { useLog, type Guard } from './guard'
import { useQuickMeals } from './quickMeals'
import { rowButtonClasses, Tile } from './rows'

// The Meals to log in one tap, each with its Servings, then "Something else" for anything else.
export function QuickList({ day, guard, logOther }: { day: string; guard: Guard; logOther: () => void }) {
  const meals = useQuickMeals()
  const log = useLog(day, guard)

  return (
    <>
      <SectionHeader id="calories-quick-list">Quick list</SectionHeader>
      {meals.isError && <LoadProblem message="Couldn't load your Meals." retry={() => meals.refetch()} />}
      <GroupedList as="ul" labelledBy="calories-quick-list">
        {meals.data?.map((meal) => (
          <QuickMeal
            key={meal.id}
            meal={meal}
            log={(servings, done) => guard.check(meal.kcal * servings, () => log.mutateAsync({ mealId: meal.id, servings }).then(done))}
          />
        ))}
        <li>
          <button type="button" aria-haspopup="dialog" onClick={logOther} className={rowButtonClasses}>
            <Tile>
              <Plus {...lucideProps} className="size-5 text-accent" />
            </Tile>
            <span className="flex-1">Something else</span>
            <ChevronRight {...lucideProps} className="size-5 text-sub" />
          </button>
        </li>
      </GroupedList>
    </>
  )
}

function QuickMeal({ meal, log }: { meal: Meal; log: (servings: number, done: () => void) => void }) {
  const [servings, setServings] = useState(1)
  return (
    <ListRow as="li" className="gap-2!">
      <Tile>{meal.emoji}</Tile>
      <span className="min-w-0 flex-1">
        <span lang="ja" className="line-clamp-2 text-[17px] leading-snug">
          {meal.name}
        </span>
        <span className="block text-[13px] text-sub">{kcal(meal.kcal)} kcal</span>
      </span>
      <ServingsStepper servings={servings} onChange={setServings} />
      <Button variant="accent" aria-label={`Log ${meal.name}`} onPress={() => log(servings, () => setServings(1))} className="px-3.5!">
        Log
      </Button>
    </ListRow>
  )
}

const stepButton =
  'flex h-11 w-9 min-h-0 items-center justify-center rounded-full bg-transparent p-0 text-ink data-[disabled]:opacity-30 data-[pressed]:opacity-60'

// Whole Servings from 1 to 100: − and + on a fill pill, the number between them.
function ServingsStepper({ servings, onChange }: { servings: number; onChange: (servings: number) => void }) {
  return (
    <NumberField
      aria-label="Servings"
      minValue={1}
      maxValue={100}
      value={servings}
      // Cleared and left empty, it goes back to 1.
      onChange={(value) => onChange(Number.isNaN(value) ? 1 : value)}
      className="shrink-0"
    >
      <Group className="flex items-center rounded-full bg-fill">
        <AriaButton slot="decrement" aria-label="Fewer servings" className={stepButton}>
          <Minus {...lucideProps} className="size-4" />
        </AriaButton>
        <Input className="m-0 h-11 min-h-0 w-5 rounded-none border-0 bg-transparent p-0 text-center text-[16px] font-semibold tabular-nums outline-none" />
        <AriaButton slot="increment" aria-label="More servings" className={stepButton}>
          <Plus {...lucideProps} className="size-4" />
        </AriaButton>
      </Group>
    </NumberField>
  )
}
