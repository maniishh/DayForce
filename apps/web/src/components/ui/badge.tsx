import { clsx } from 'clsx';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'indigo';

const variants: Record<Variant, string> = {
  default:  'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  success:  'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
  warning:  'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60',
  danger:   'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60',
  info:     'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60',
  indigo:   'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60',
  muted:    'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
};

export function Badge({ children, variant = 'default', className }: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

export function severityBadge(severity: string) {
  const map: Record<string, Variant> = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' };
  return <Badge variant={map[severity] || 'muted'}>{severity}</Badge>;
}

export function statusBadge(status: string) {
  const map: Record<string, Variant> = {
    DETECTED:             'warning',
    INVESTIGATING:        'info',
    WAITING_FOR_APPROVAL: 'warning',
    APPROVED:             'success',
    RESOLVED:             'success',
    REJECTED:             'danger',
    CANCELLED:            'muted',
    ESCALATED:            'danger',
    NEEDS_MORE_INFO:      'warning',
    FAILED:               'danger',
    PENDING:              'warning',
    CONSUMED:             'success',
    EXPIRED:              'muted',
  };
  return <Badge variant={map[status] || 'default'}>{status.replace(/_/g, ' ')}</Badge>;
}
