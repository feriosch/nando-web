import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../core/services'
import type { Meal } from './calories'

// The Meals in use, pinned first, then the most logged.
export function useQuickMeals() {
  const api = useApi()
  return useQuery({ queryKey: ['calories', 'meals', 'quick'], queryFn: () => api.get<Meal[]>('/api/calories/meals/quick') })
}
