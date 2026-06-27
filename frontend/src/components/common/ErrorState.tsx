import { AlertTriangle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message?: string
}

export function ErrorState({ title = 'Something went wrong', message }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-rose-400" />
      </div>
      <p className="text-zinc-200 font-medium">{title}</p>
      {message && <p className="text-zinc-500 text-sm mt-2 max-w-md">{message}</p>}
    </div>
  )
}
