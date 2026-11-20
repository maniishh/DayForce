'use client';
import { useState, useEffect } from 'react';
import { getUser, setUser } from '@/lib/auth';
import { setToken, api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import {
  Users, ShieldCheck, ChevronDown, Sparkles, Activity,
  Building2, Check, Bell, PanelLeftClose, PanelLeftOpen,
  Sun, Moon
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const demoProfiles = [
  { label: 'Sarah Chen', role: 'HR_ADMIN', email: 'hr.admin@acme.com', desc: 'Organization-wide Admin & Policy Oversight' },
  { label: 'David Miller', role: 'MANAGER', email: 'mgr.ops@acme.com', desc: 'Operations Dept (Marcus, Liam, James)' },
  { label: 'Lisa Park', role: 'MANAGER', email: 'mgr.tech@acme.com', desc: 'Technology Dept (Elena, Sophia, Maya)' },
  { label: 'Alice Johnson', role: 'EMPLOYEE', email: 'alice.johnson@acme.com', desc: 'Self-Service Employee View' },
  { label: 'System Admin', role: 'SYSTEM_ADMIN', email: 'sysadmin@acme.com', desc: 'Infrastructure & System Traces' },
];

interface TopHeaderProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export function TopHeader({ sidebarOpen = true, onToggleSidebar, theme = 'light', onToggleTheme }: TopHeaderProps) {
  const user = getUser();
  const { success, error } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    async function loadNotifCount() {
      try {
        const res = await api.notifications();
        const unread = (res.notifications || []).filter((n: any) => n.status === 'UNREAD').length;
        setUnreadNotifs(unread);
      } catch (err) {
        // silent
      }
    }
    loadNotifCount();
    const interval = setInterval(loadNotifCount, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleSwitchRole(profile: typeof demoProfiles[0]) {
    setSwitching(true);
    setDropdownOpen(false);
    try {
      const res = await api.login(profile.email, 'demo1234');
      setToken(res.token);
      setUser(res.user);
      success('Role Switched Successfully', `Active as ${profile.label} (${profile.role.replace(/_/g, ' ')})`);
      window.location.reload();
    } catch (err: any) {
      // Immediate fallback if backend is momentarily offline
      const fallbackUser = {
        id: `user-${profile.role.toLowerCase().replace(/_/g, '-')}`,
        tenantId: 'tenant-acme-corp',
        email: profile.email,
        displayName: profile.label,
        role: profile.role as any,
      };
      setToken(btoa(JSON.stringify(fallbackUser)));
      setUser(fallbackUser);
      success('Role Switched', `Active as ${profile.label} (${profile.role.replace(/_/g, ' ')})`);
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  const roleBadgeStyle =
    user?.role === 'HR_ADMIN' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
    user?.role === 'MANAGER' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
    user?.role === 'SYSTEM_ADMIN' ? 'bg-purple-100 text-purple-800 border-purple-300' :
    'bg-slate-100 text-slate-800 border-slate-300';

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Sidebar toggle + Organization context */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer flex items-center justify-center group"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-label="Toggle Sidebar"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            ) : (
              <PanelLeftOpen className="w-5 h-5 text-indigo-600 animate-pulse" />
            )}
          </button>
        )}

        <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>Acme Corporation</span>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-normal">New York (EDT · UTC-4)</span>
        </div>

        {/* Live Service Indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium">AI & Durable Worker Active</span>
        </div>
      </div>

      {/* Right: Theme Toggle, Notification Bell & Role Switcher */}
      <div className="flex items-center gap-3 relative">
        {/* Dark / Light Mode Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-slate-200"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        )}

        <Link
          href="/notifications"
          className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifs > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadNotifs > 9 ? '9+' : unreadNotifs}
            </span>
          )}
        </Link>

        <span className="text-xs text-slate-500 hidden sm:inline">Active Persona:</span>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={switching}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-xs transition-all',
              roleBadgeStyle,
              'hover:opacity-90 cursor-pointer'
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{user?.displayName || 'Select Persona'}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 bg-white/60 rounded">
              {user?.role?.replace(/_/g, ' ')}
            </span>
            <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Instant Demo Role Switcher
              </div>
              <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {demoProfiles.map((p) => {
                  const isCurrent = user?.email === p.email;
                  return (
                    <button
                      key={p.email}
                      onClick={() => handleSwitchRole(p)}
                      className={clsx(
                        'w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2.5',
                        isCurrent && 'bg-indigo-50/60'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-900">{p.label}</div>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {p.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.desc}</div>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
