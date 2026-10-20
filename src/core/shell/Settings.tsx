import type { SettingsSection } from '../module'

export function Settings({ sections }: { sections: SettingsSection[] }) {
  return (
    <>
      <h1>Settings</h1>
      {sections.map(({ id, title, Component }) => (
        <section key={id} aria-labelledby={`settings-${id}`}>
          <h2 id={`settings-${id}`}>{title}</h2>
          <Component />
        </section>
      ))}
    </>
  )
}
