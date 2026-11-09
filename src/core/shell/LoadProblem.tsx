// What a screen or card shows when what it needs couldn't be loaded, such as on a weak connection:
// `message`, and a button to load it again.
export function LoadProblem({ message, retry }: { message: string; retry: () => void }) {
  return (
    <>
      <p role="alert">{message}</p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </>
  )
}
