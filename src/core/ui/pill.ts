export type Variant = 'accent' | 'quiet'

// The pill's look, for the rare native <button> that must handle the click itself, such as one
// asking for a permission that Safari grants only from within a tap's click.
export function pillClasses(variant: Variant = 'quiet') {
  const colours = variant === 'accent' ? 'bg-accent text-accent-ink' : 'bg-fill text-ink'
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[16px] font-semibold ${colours} transition-opacity disabled:opacity-50 data-[disabled]:opacity-50 active:opacity-70`
}
