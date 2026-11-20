'use client';
import React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;           // e.g. 'indigo', 'emerald', 'amber', 'red'
  trend?: { value: string; direction: 'up' | 'down' | 'flat' };
  subtitle?: string;
  onClick?: () => void;
}

const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
  amber:   { bg: 'bg-amber-50 dark:bg-amber-950/40',   icon: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-100 dark:ring-amber-900/50' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-950/40',  icon: 'text-indigo-600 dark:text-indigo-400',  ring: 'ring-indigo-100 dark:ring-indigo-900/50' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', icon: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-100 dark:ring-emerald-900/50' },
  red:     { bg: 'bg-red-50 dark:bg-red-950/40',     icon: 'text-red-600 dark:text-red-400',     ring: 'ring-red-100 dark:ring-red-900/50' },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-950/40',    icon: 'text-blue-600 dark:text-blue-400',    ring: 'ring-blue-100 dark:ring-blue-900/50' },
  slate:   { bg: 'bg-slate-50 dark:bg-slate-800/60',   icon: 'text-slate-600 dark:text-slate-300',   ring: 'ring-slate-100 dark:ring-slate-700/50' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-950/40',  icon: 'text-violet-600 dark:text-violet-400',  ring: 'ring-violet-100 dark:ring-violet-900/50' },
};

export function StatCard({ label, value, icon: Icon, color, trend, subtitle, onClick }: StatCardProps) {
  const c = colorMap[color] || colorMap.slate;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm transition-all duration-200 animate-slide-up',
        onClick && 'cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('p-2.5 rounded-xl ring-1', c.bg, c.ring)}>
          <Icon className={clsx('w-5 h-5', c.icon)} />
        </div>
        {trend && (
          <div className={clsx(
            'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            trend.direction === 'up' && 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
            trend.direction === 'down' && 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50',
            trend.direction === 'flat' && 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800',
          )}>
            {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend.direction === 'flat' && <Minus className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{label}</div>
      {subtitle && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{subtitle}</div>}
    </div>
  );
}
