// A Weigh-in: the Owner's weight for the week starting on Monday `week` (YYYY-MM-DD), in kg.
export type WeighIn = { week: string; kg: number }

// What GET /api/body answers for the Body Home Card.
export type Body = {
  latest: WeighIn | null
  bmi: number | null
  change: number | null
}
