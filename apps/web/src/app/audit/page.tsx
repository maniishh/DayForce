'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Shield, RefreshCw, Lock, Search, Database, User, Zap } from 'lucide-react';
import { clsx } from 'clsx';

export default function AuditPage() {
  const [logs,    setLogs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const user = getUser();
  const canView = user?.role === 'HR_ADMIN' || user?.role === 'SYSTEM_ADMIN';

  async function load() {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await api.audit({ limit: '100' });
      setLogs(r.logs || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = logs.filter((l) =>
    !search ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.actor_id?.toLowerCase().includes(search.toLowerCase())
  );

  const actorIcons: Record<string, { icon: React.ElementType; color: string }> = {
    USER:     { icon: User, color: 'bg-blue-100 text-blue-600' },
    SYSTEM:   { icon: Database, color: 'bg-slate-100 text-slate-600' },
    WORKFLOW: { icon: Zap, color: 'bg-indigo-100 text-indigo-600' },
  };

  if (!canView) {
    return (
      <div className="w-full max-w-[1400px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-slate-900 mb-5">Audit Log</h1>
        <Card>
          <CardBody>
            <EmptyState
              icon={Lock}
              title="Access Restricted"
              description={`Only HR Admins and System Admins can view the audit log. Your role is ${user?.role?.replace(/_/g, ' ')}.`}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">Immutable record of all system actions</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action or entity…"
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300 transition-colors w-56"
            />
          </div>
          <button onClick={load} className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Card>
        {loading ? (
          <CardBody className="flex justify-center py-16"><Spinner size="lg" /></CardBody>
        ) : filtered.length === 0 ? (
          <CardBody>
            <EmptyState icon={Shield} title="No audit events found" description="Actions will be logged as the system processes exceptions." />
          </CardBody>
        ) : (
          <CardBody className="p-0">
            <div className="divide-y divide-slate-100">
              {filtered.map((log, idx) => {
                const actor = actorIcons[log.actor_type] || actorIcons.SYSTEM;
                const ActorIcon = actor.icon;
                return (
                  <div key={log.id} className="flex gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors animate-fade-in" style={{ animationDelay: `${idx * 20}ms` }}>
                    {/* Timeline */}
                    <div className="relative flex flex-col items-center pt-1">
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', actor.color)}>
                        <ActorIcon className="w-4 h-4" />
                      </div>
                      {idx < filtered.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-2" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{log.entity_type}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 font-mono">{log.entity_id?.slice(0, 24)}</div>
                      {log.reason && <div className="text-xs text-slate-600 mt-1.5 italic bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">{log.reason}</div>}
                      {log.after && (
                        <details className="mt-1.5">
                          <summary className="text-[11px] text-indigo-600 cursor-pointer hover:underline font-medium">View changes</summary>
                          <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg p-2 mt-1 overflow-x-auto border border-slate-100">
                            {JSON.stringify(log.after, null, 2).slice(0, 300)}
                          </pre>
                        </details>
                      )}
                      <div className="text-[11px] text-slate-400 mt-1.5">{new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
