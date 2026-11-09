import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../core/services'

// Puts an archived Meal back in use.
export function useRestore(onSuccess?: () => void) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/calories/meals/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calories'] })
      onSuccess?.()
    },
  })
}
