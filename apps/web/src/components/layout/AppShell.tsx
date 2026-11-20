'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, setUser } from '@/lib/auth';
import { setToken } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { Spinner } from '../ui/spinner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const router   = useRouter();
  const pathname = usePathname();

  // Load user preference for sidebar state and theme from localStorage
  useEffect(() => {
    try {
      const savedSidebar = localStorage.getItem('attendwise_sidebar_open');
      if (savedSidebar !== null) {
        setSidebarOpen(savedSidebar === 'true');
      }

      const savedTheme = localStorage.getItem('attendwise_theme');
      if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setTheme('dark');
        document.documentElement.classList.add('dark');
      } else {
        setTheme('light');
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('attendwise_sidebar_open', String(next));
      } catch (e) {}
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('attendwise_theme', next);
        if (next === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    if (pathname === '/login') {
      setReady(true);
      return;
    }
    let user = getUser();
    if (!user) {
      // Auto-initialize demo persona (David Miller - Operations Manager) so app loads immediately
      const demoUser = {
        id: 'user-mgr-ops',
        tenantId: 'tenant-acme-corp',
        email: 'mgr.ops@acme.com',
        displayName: 'David Miller',
        role: 'MANAGER' as const,
        employeeId: 'emp-mgr-ops',
      };
      try {
        setUser(demoUser);
        setToken('demo-jwt-token-mgr-ops');
      } catch (e) {
        console.warn('Storage init warning:', e);
      }
    }
    setReady(true);
  }, [pathname]);

  if (pathname === '/login') return <>{children}</>;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Static Fixed Sidebar */}
      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
      
      {/* Main View Area: Fixed Header + Scrollable Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Strictly static/fixed top header: never scrolls */}
        <TopHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
