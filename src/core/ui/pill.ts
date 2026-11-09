export type Variant = 'accent' | 'quiet'
// `large`: full width and 50px tall, for a screen's one main action at the end of it.
export type Size = 'regular' | 'large'

// The pill's look, for the rare native <button> that must handle the click itself, such as one
// asking for a permission that Safari grants only from within a tap's click.
export function pillClasses(variant: Variant = 'quiet', size: Size = 'regular') {
  const colours = variant === 'accent' ? 'bg-accent text-accent-ink' : 'bg-fill text-ink'
  const dimensions = size === 'large' ? 'h-[50px] w-full text-[17px]' : 'min-h-11 text-[16px]'
  return `inline-flex ${dimensions} items-center justify-center gap-2 rounded-full px-5 font-semibold ${colours} transition-opacity disabled:opacity-50 data-[disabled]:opacity-50 active:opacity-70`
}
