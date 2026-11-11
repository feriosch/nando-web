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
