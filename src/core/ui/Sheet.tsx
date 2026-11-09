import type { ReactNode } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

// A bottom sheet: slides up over a scrim, 22px top corners, a grab handle. Tapping the scrim or
// Escape closes it when `dismissable`. `title` is its heading and accessible name.
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  dismissable = true,
  children,
}: {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  title: string
  dismissable?: boolean
  children: ReactNode
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={dismissable}
      className="fixed inset-0 z-50 flex items-end bg-black/40 data-[entering]:animate-[fade-in_200ms_ease-out] data-[exiting]:animate-[fade-out_200ms_ease-in]"
    >
      <Modal className="w-full rounded-t-[22px] bg-surface px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))] text-ink shadow-xl data-[entering]:animate-[sheet-in_260ms_cubic-bezier(0.2,0.9,0.3,1)] data-[exiting]:animate-[sheet-out_200ms_ease-in]">
        <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-line" />
        <Dialog className="outline-none">
          <Heading slot="title" className="mt-0 mb-3 font-display text-[20px] font-bold">
            {title}
          </Heading>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
