import type { SettingsSection } from '../module'
import { SectionHeader } from '../ui/List'
import { ScreenHeader } from '../ui/ScreenHeader'

export function Settings({ sections }: { sections: SettingsSection[] }) {
  return (
    <>
      <ScreenHeader title="Settings" />
      {sections.map(({ id, title, Component }) => (
        <section key={id} aria-labelledby={`settings-${id}`}>
          <SectionHeader id={`settings-${id}`}>{title}</SectionHeader>
          <Component />
        </section>
      ))}
    </>
  )
}
