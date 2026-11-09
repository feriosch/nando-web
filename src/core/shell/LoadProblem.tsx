import { Button } from '../ui/Button'

// What a screen or card shows when what it needs couldn't be loaded, such as on a weak connection:
// `message`, centred, and a quiet pill to load it again.
export function LoadProblem({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-5 text-center">
      <p role="alert" className="my-0 text-[15px] text-sub">
        {message}
      </p>
      <Button onPress={retry}>Try again</Button>
    </div>
  )
}
