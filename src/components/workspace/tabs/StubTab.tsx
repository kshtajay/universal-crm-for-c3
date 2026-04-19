interface Props {
  label: string
}

export function StubTab({ label }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center p-6">
      <p className="text-muted-foreground text-sm">{label} — coming in a later phase</p>
    </div>
  )
}
