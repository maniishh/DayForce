'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, AlertTriangle, CheckSquare, Users,
  Clock, FileText, Shield, Bell, LogOut, ChevronRight, Sparkles, Bot,
  PanelLeftClose
} from 'lucide-react';
import { clearAuth, getUser } from '@/lib/auth';
import { clearToken } from '@/lib/api';

type Role = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SYSTEM_ADMIN';

interface NavItem {
  href:   string;
  label:  string;
  icon:   React.ElementType;
  roles?: Role[];
}

const nav: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/agents',        label: 'AI Agents & Architecture', icon: Bot },
  { href: '/exceptions',    label: 'Exceptions',        icon: AlertTriangle },
  {
    href: '/approvals',
    label: 'Approval Inbox',
    icon: CheckSquare,
    roles: ['MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'],
  },
  { href: '/attendance',    label: 'Attendance & Punches', icon: Clock },
  { href: '/policies',      label: 'Policy Knowledge',   icon: FileText },
  {
    href: '/employees',  label: 'Employees',          icon: Users,
    roles: ['MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'],
  },
  {
    href: '/audit',      label: 'Audit Log',          icon: Shield,
    roles: ['HR_ADMIN', 'SYSTEM_ADMIN'],
  },
  { href: '/notifications', label: 'Notifications',     icon: Bell },
];

const roleBadgeColor: Record<Role, string> = {
  EMPLOYEE:     'bg-slate-700 text-slate-300',
  MANAGER:      'bg-indigo-700 text-indigo-200',
  HR_ADMIN:     'bg-emerald-800 text-emerald-200',
  SYSTEM_ADMIN: 'bg-purple-900 text-purple-200',
};

interface SidebarProps {
  open?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ open = true, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const user     = getUser();
  const role     = user?.role as Role | undefined;

  function handleLogout() {
    clearAuth();
    clearToken();
    window.location.href = '/login';
  }

  const visibleNav = nav.filter((item) =>
    !item.roles || (role && item.roles.includes(role))
  );

  return (
    <aside
      className={clsx(
        'min-h-screen bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out z-40 select-none flex-shrink-0',
        open
          ? 'w-64 translate-x-0 opacity-100'
          : 'w-0 -translate-x-full opacity-0 overflow-hidden border-none pointer-events-none'
      )}
    >
      <div className="w-64 flex flex-col min-h-screen">
        {/* Logo & Collapse button */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-indigo-500/20">
              AW
            </div>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-1.5">
                AttendWise AI
                <Sparkles className="w-3 h-3 text-indigo-400" />
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Agentic T&A Platform</div>
            </div>
          </div>
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Collapse Sidebar"
              aria-label="Collapse Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        {user && (
          <div className="px-3 py-4 border-t border-slate-800 mt-auto">
            <div className="px-3 py-2.5 mb-2 bg-slate-800/50 rounded-xl">
              <div className="text-xs font-semibold text-slate-200 truncate">{user.displayName}</div>
              <div className="mt-1.5">
                <span className={clsx(
                  'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
                  role ? roleBadgeColor[role] : 'bg-slate-700 text-slate-300'
                )}>
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
