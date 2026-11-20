'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Bell, CheckCheck, RefreshCw, AlertTriangle, Info, CheckCircle2, MessageSquare, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

export default function NotificationsPage() {
  const [notifs,  setNotifs]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<'all' | 'unread'>('all');
  const [creating, setCreating] = useState(false);
  const { success, error: showError } = useToast();

  async function load() {
    setLoading(true);
    try {
      const r = await api.notifications();
      setNotifs(r.notifications || []);
    } catch (e: any) {
      console.error('Notifications fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await api.markRead(id);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, status: 'READ' } : n));
      success('Notification marked as read');
    } catch (e: any) {
      showError('Action failed', e.message);
    }
  }

  async function markAllRead() {
    try {
      await api.markAllRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, status: 'READ' })));
      success('All notifications marked as read');
    } catch (e: any) {
      showError('Action failed', e.message);
    }
  }

  async function createTestNotification() {
    setCreating(true);
    try {
      await api.createTestNotification();
      success('Notification Created', 'Live system notification generated.');
      await load();
    } catch (e: any) {
      showError('Failed to create notification', e.message);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => { load(); }, []);

  const unreadCount = notifs.filter((n) => n.status === 'UNREAD').length;
  const display = filter === 'unread' ? notifs.filter((n) => n.status === 'UNREAD') : notifs;

  const typeIcon = (type: string) => {
    if (type?.includes('EXCEPTION') || type?.includes('ALERT')) return AlertTriangle;
    if (type?.includes('APPROVAL')) return CheckCircle2;
    if (type?.includes('PUNCH')) return CheckCircle2;
    if (type?.includes('INFO') || type?.includes('POLICY')) return Info;
    return MessageSquare;
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">{unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
            >
              Mark all read
            </button>
          )}

          <button
            onClick={createTestNotification}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {creating ? <Spinner size="sm" /> : <Plus className="w-3.5 h-3.5" />}
            Test Alert
          </button>

          <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-100 p-0.5">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1 text-xs font-semibold transition-colors capitalize rounded-lg',
                  filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Card>
        {loading ? (
          <CardBody className="flex justify-center py-16"><Spinner size="lg" /></CardBody>
        ) : display.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={Bell}
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              description="You're all caught up! You can generate a test notification or run a scan to see new updates."
              action={
                <button
                  onClick={createTestNotification}
                  disabled={creating}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Generate Live Alert
                </button>
              }
            />
          </CardBody>
        ) : (
          <div className="divide-y divide-slate-100">
            {display.map((n, idx) => {
              const Icon = typeIcon(n.type);
              const linkUrl = n.related_entity_type === 'ExceptionCase'
                ? `/exceptions/${n.related_entity_id}`
                : n.type === 'APPROVAL_REQUESTED'
                  ? '/approvals'
                  : n.type === 'ATTENDANCE_PUNCH'
                    ? '/attendance'
                    : n.type === 'POLICY_INGESTED'
                      ? '/policies'
                      : null;

              return (
                <div
                  key={n.id}
                  className={clsx(
                    'flex items-start gap-4 px-5 py-4 transition-colors animate-fade-in',
                    n.status === 'UNREAD' ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'bg-white hover:bg-slate-50',
                  )}
                  style={{ animationDelay: `${idx * 25}ms` }}
                >
                  <div className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm',
                    n.status === 'UNREAD' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500',
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className={clsx('text-sm font-semibold', n.status === 'UNREAD' ? 'text-slate-900' : 'text-slate-600')}>
                        {n.title}
                      </div>
                      <div className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                        {new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {n.related_entity_type && (
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                          {n.related_entity_type}
                        </span>
                      )}
                      {linkUrl && (
                        <Link
                          href={linkUrl}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                        >
                          View Details <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  {n.status === 'UNREAD' && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 p-2 rounded-lg flex-shrink-0 transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
