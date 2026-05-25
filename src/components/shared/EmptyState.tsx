import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
}

export function EmptyState({ icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/50" />}
      <p className="text-foreground font-medium">{title}</p>
      {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
    </div>
  )
}

export function LoadingState({ text = 'טוען...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  )
}
