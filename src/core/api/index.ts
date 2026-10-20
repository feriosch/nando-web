import { apiBaseUrl } from '../config'
import { createApiClient } from './client'

export { ApiError, type ApiClient } from './client'

export const api = createApiClient({ baseUrl: apiBaseUrl })
