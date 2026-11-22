// Core's settings, as GET /api/settings answers them and PUT /api/settings takes them.
export type CoreSettings = {
  // The Owner Time Zone, an IANA name such as "Asia/Tokyo".
  timeZone: string
  // The Owner's height, which Calories reads for the BMI (ADR 0012).
  heightCm: number | null
  // The daily Notification that asks the Core Assistant for the Gmail Digest, at `time` ("HH:MM" on
  // the hour or half hour). A server from before it leaves it out, and is then sent none.
  gmailDigest?: GmailDigest
}

export type GmailDigest = { enabled: boolean; time: string }

// "00:00" to "23:30": a Notification goes out on the hour or half hour, when the scheduler ticks,
// so these are the only times a Notification can be set for.
export const reminderTimes = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

// The same times as options for a Picker.
export const reminderTimeOptions = reminderTimes.map((time) => ({ value: time, label: time }))
