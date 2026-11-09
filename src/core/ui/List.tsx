import type { ReactNode } from 'react'

// A section header above a grouped list: 13px, uppercase, in the secondary colour.
export function SectionHeader({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mx-4 mt-7 mb-1.5 text-[13px] font-normal tracking-wide text-sub uppercase">
      {children}
    </h2>
  )
}

// The grouped inset list: rows on the surface colour, 14px corners, hairline separators. Its 16px
// side margins are the screen's own padding. An optional footer explains the rows, under the list.
// `as="ul"` makes it a list (named by `labelledBy`), its rows `ListRow as="li"`.
export function GroupedList({
  children,
  footer,
  as: List = 'div',
  labelledBy,
}: {
  children: ReactNode
  footer?: ReactNode
  as?: 'div' | 'ul'
  labelledBy?: string
}) {
  return (
    <div className="my-2">
      <List
        aria-labelledby={labelledBy}
        className="my-0 list-none divide-y-[0.5px] divide-line overflow-hidden rounded-[14px] bg-surface p-0"
      >
        {children}
      </List>
      {footer && <div className="mx-4 mt-1.5 text-[13px] text-sub">{footer}</div>}
    </div>
  )
}

// One row of a grouped list, at least 52px tall: a label on the left, its value or control on the right.
export function ListRow({
  children,
  className = '',
  as: Row = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  return <Row className={`flex min-h-[52px] items-center justify-between gap-3 px-4 py-2 ${className}`}>{children}</Row>
}
