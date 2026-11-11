import { useId, type ReactNode } from 'react'
import { GroupedList, SectionHeader } from '../../core/ui/List'

// A section of a Word or Kanji page: its header over a grouped list, which is a list named by the header if `list`.
export function Section({ title, list = false, children }: { title: string; list?: boolean; children: ReactNode }) {
  const id = useId()
  return (
    <>
      <SectionHeader id={id}>{title}</SectionHeader>
      {list ? (
        <GroupedList as="ul" labelledBy={id}>
          {children}
        </GroupedList>
      ) : (
        children
      )}
    </>
  )
}

// Free text in Spanish, such as a Word's notes or a Kanji's story, in a grouped list of its own,
// keeping its line breaks.
export function TextBlock({ children }: { children: ReactNode }) {
  return (
    <GroupedList>
      <p lang="es" className="m-0 px-4 py-3 text-[17px] whitespace-pre-line">
        {children}
      </p>
    </GroupedList>
  )
}
