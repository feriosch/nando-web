import type { ReactNode } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

// A bottom sheet: slides up over a scrim, 22px top corners, a grab handle. Tapping the scrim or
// Escape closes it when `dismissable`. `title` is its heading and accessible name. A sheet that asks
// before going on, or says what went wrong, is an `alertdialog`.
//
// The overlay is as tall as the visual viewport (React Aria's `--visual-viewport-height`), not the
// screen: the iPhone's keyboard covers the page rather than resizing it, and React Aria stops
// Safari scrolling the page to the focused field, so a sheet sized to the screen sits under the
// keyboard. Sized to what is still visible, the sheet rides up on top of the keyboard instead,
// and drops the home indicator's inset from its bottom padding while the keyboard is up.
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  dismissable = true,
  role = 'dialog',
  children,
}: {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  title: string
  dismissable?: boolean
  role?: 'dialog' | 'alertdialog'
  children: ReactNode
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={dismissable}
      className="fixed top-0 left-0 z-50 flex h-(--visual-viewport-height) w-full items-end bg-black/40 data-[entering]:animate-[fade-in_200ms_ease-out] data-[exiting]:animate-[fade-out_200ms_ease-in]"
    >
      <Modal
        data-sheet
        className="max-h-[92%] w-full overflow-y-auto rounded-t-[22px] bg-surface px-4 pt-2 pb-[max(16px,calc(16px_+_env(safe-area-inset-bottom)_-_(100dvh_-_var(--visual-viewport-height))))] text-ink shadow-xl data-[entering]:animate-[sheet-in_260ms_cubic-bezier(0.2,0.9,0.3,1)] data-[exiting]:animate-[sheet-out_200ms_ease-in]">
        <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-line" />
        <Dialog role={role} className="outline-none">
          <Heading slot="title" className="mt-0 mb-3 font-display text-[20px] font-bold">
            {title}
          </Heading>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
