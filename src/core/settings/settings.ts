export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

// Core's settings, as GET /api/settings answers them and PUT /api/settings takes them.
export type CoreSettings = {
  // The Owner Time Zone, an IANA name such as "Asia/Tokyo".
  timeZone: string
  heightCm: number | null
  // `time` is "HH:MM" on the hour or half hour, in the Owner Time Zone.
  weighInReminder: { enabled: boolean; weekday: Weekday; time: string }
}

// "00:00" to "23:30": a Notification goes out on the hour or half hour, when the scheduler ticks,
// so these are the only times a reminder can be set for (Core's or a Module's).
export const reminderTimes = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
