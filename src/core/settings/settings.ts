export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

// Core's settings, as GET /api/settings answers them and PUT /api/settings takes them.
export type CoreSettings = {
  // The Owner Time Zone, an IANA name such as "Asia/Tokyo".
  timeZone: string
  heightCm: number | null
  // `time` is "HH:MM" on the hour or half hour, in the Owner Time Zone.
  weighInReminder: { enabled: boolean; weekday: Weekday; time: string }
}
