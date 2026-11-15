import { useId, type ReactNode } from 'react'
import { GroupedList, ListRow, SectionHeader } from './List'

// A section of a page, such as a Word's Notes or an Opportunity's Steps: its header over its content,
// as a region named by the header. With `list`, the content is a grouped list, also named by the
// header, whose rows are `li`s (such as `Detail`s).
export function Section({ title, list = false, children }: { title: string; list?: boolean; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <SectionHeader id={id}>{title}</SectionHeader>
      {list ? (
        <GroupedList as="ul" labelledBy={id}>
          {children}
        </GroupedList>
      ) : (
        children
      )}
    </section>
  )
}

// Free text, such as a Word's notes or a Company Brief, in a grouped list of its own, keeping its
// line breaks, in the language `lang` (such as "es" for Spanish) when known.
export function TextBlock({ lang, children }: { lang?: string; children: ReactNode }) {
  return (
    <GroupedList>
      <p lang={lang} className="m-0 px-4 py-3 text-[17px] whitespace-pre-line">
        {children}
      </p>
    </GroupedList>
  )
}

// A row of a page's details: its label, and its value on the right.
export function Detail({ label, lang, children }: { label: string; lang?: string; children: ReactNode }) {
  return (
    <ListRow as="li">
      <span className="shrink-0">{label}</span>
      <span lang={lang} className="text-right text-sub tabular-nums">
        {children}
      </span>
    </ListRow>
  )
}
