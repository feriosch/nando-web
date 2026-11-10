import type { ModuleIcon, SettingsSection } from '../module'
import { SectionHeader } from '../ui/List'
import { ScreenHeader } from '../ui/ScreenHeader'
import { appVersionLabel } from '../version'

// A Settings Section with the tint of the Module that contributed it, if any: the Module's theme
// and icon. Core's sections have none and sit in the screen's own theme.
export type TintedSettingsSection = SettingsSection & { tint?: { theme: string; icon: ModuleIcon } }

// The single Settings screen: each Settings Section under its header. A Module's section takes its
// Module's theme as a tint: its grouped lists on the Module's surface with a hairline border, its
// header in the Module's accent after the Module's icon. The app's version closes the screen.
export function Settings({ sections }: { sections: TintedSettingsSection[] }) {
  return (
    <>
      <ScreenHeader title="Settings" />
      {sections.map(({ id, title, Component, tint }) => (
        <section
          key={id}
          aria-labelledby={`settings-${id}`}
          data-tint={tint ? '' : undefined}
          className={tint ? `${tint.theme} text-ink` : undefined}
        >
          <SectionHeader
            id={`settings-${id}`}
            tone={tint ? 'accent' : 'sub'}
            icon={tint && <tint.icon className="size-[18px] shrink-0" />}
          >
            {title}
          </SectionHeader>
          <Component />
        </section>
      ))}
      <p className="mt-8 mb-2 text-center text-[13px] text-sub">{appVersionLabel}</p>
    </>
  )
}
