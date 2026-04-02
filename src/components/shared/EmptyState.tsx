import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
}

export function EmptyState({ icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {Icon && <Icon className="h-10 w-10 text-slate-600" />}
      <p className="text-slate-400 font-medium">{title}</p>
      {subtitle && <p className="text-slate-600 text-sm">{subtitle}</p>}
    </div>
  )
}

export function LoadingState({ text = 'טוען...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  )
}
