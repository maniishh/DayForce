'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardBody } from '@/components/ui/card';
import { Badge, severityBadge, statusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { ComplianceShieldIllustration } from '@/components/ui/Illustrations';
import {
  AlertTriangle, Search, RefreshCw, ChevronRight, Filter, X,
  Clock, ShieldAlert, Sparkles, CheckCircle2, Bot, ArrowRight,
  TrendingUp, Calendar, AlertCircle, ClockAlert, AlarmClockOff,
  CalendarX, AlertOctagon, LogIn, LogOut, Activity, Building2
} from 'lucide-react';
import { clsx } from 'clsx';

function getInitials(name: string): string {
  if (!name) return 'EX';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function getAvatarBg(dept: string): string {
  const colors = [
    'from-indigo-500 to-violet-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
  ];
  let hash = 0;
  for (let i = 0; i < (dept || '').length; i++) hash += dept.charCodeAt(i);
  return colors[hash % colors.length];
}

function getExceptionConfig(type: string) {
  switch (type) {
    case 'MISSING_CLOCK_OUT':
      return {
        icon: ClockAlert,
        color: 'bg-rose-50 text-rose-700 border-rose-200',
        badgeColor: 'text-rose-600',
      };
    case 'MISSING_CLOCK_IN':
      return {
        icon: LogIn,
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeColor: 'text-amber-600',
      };
    case 'LATE_ARRIVAL':
      return {
        icon: AlarmClockOff,
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeColor: 'text-amber-600',
      };
    case 'EARLY_DEPARTURE':
      return {
        icon: LogOut,
        color: 'bg-orange-50 text-orange-700 border-orange-200',
        badgeColor: 'text-orange-600',
      };
    case 'OVERTIME_REVIEW':
      return {
        icon: TrendingUp,
        color: 'bg-violet-50 text-violet-700 border-violet-200',
        badgeColor: 'text-violet-600',
      };
    case 'SHIFT_CONFLICT':
      return {
        icon: CalendarX,
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        badgeColor: 'text-purple-600',
      };
    default:
      return {
        icon: AlertOctagon,
        color: 'bg-slate-50 text-slate-700 border-slate-200',
        badgeColor: 'text-slate-600',
      };
  }
}

export default function ExceptionsPage() {
  const [data,    setData]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('');
  const [type,    setType]    = useState('');
  const [severity,setSeverity]= useState('');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'HIGH' | 'WAITING' | 'RESOLVED'>('ALL');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (status)   params.status   = status;
      if (type)     params.type     = type;
      if (severity) params.severity = severity;
      const r = await api.exceptions(params);
      const list = r.exceptions || [];
      // Deduplicate by ID defensively to eliminate duplicate React children keys
      const uniqueExceptions = Array.from(new Map(list.map((e: any) => [e.id, e])).values());
      setData(uniqueExceptions);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [status, type, severity]);

  const filtered = data.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !search || (
      e.employeeName?.toLowerCase().includes(q) ||
      e.exception_type?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.employeeCode?.toLowerCase().includes(q)
    );

    let matchQuick = true;
    if (quickFilter === 'HIGH') matchQuick = e.severity === 'HIGH';
    else if (quickFilter === 'WAITING') matchQuick = e.status === 'WAITING_FOR_APPROVAL';
    else if (quickFilter === 'RESOLVED') matchQuick = e.status === 'RESOLVED' || e.status === 'APPROVED';

    return matchSearch && matchQuick;
  });

  const totalCount = data.length;
  const highSeverityCount = data.filter((e) => e.severity === 'HIGH').length;
  const waitingApprovalCount = data.filter((e) => e.status === 'WAITING_FOR_APPROVAL').length;
  const resolvedCount = data.filter((e) => e.status === 'RESOLVED' || e.status === 'APPROVED').length;

  const hasFilters = !!status || !!type || !!severity || !!search || quickFilter !== 'ALL';
  const TYPES = ['MISSING_CLOCK_OUT','MISSING_CLOCK_IN','LATE_ARRIVAL','EARLY_DEPARTURE','OVERTIME_REVIEW','SHIFT_CONFLICT'];
  const STATUSES = ['DETECTED','INVESTIGATING','WAITING_FOR_APPROVAL','APPROVED','RESOLVED','REJECTED','CANCELLED'];

  function clearFilters() {
    setStatus('');
    setType('');
    setSeverity('');
    setSearch('');
    setQuickFilter('ALL');
  }

  const selectClass = "px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 cursor-pointer hover:border-slate-300 transition-colors";

  return (
    <div className="w-full max-w-[1536px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Attendance Exception Center</h1>
            <Badge variant="indigo" className="font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              LangGraph RAG Investigated
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Deterministic anomaly detection with LangGraph multi-agent RAG evidence synthesis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
          <button
            onClick={load}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-indigo-600")} />
            <span>Refresh Scan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards with Click-to-Filter and Vivid Category Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => { setQuickFilter('ALL'); setStatus(''); setSeverity(''); }}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'ALL' && !severity && !status ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="Total Exceptions" value={totalCount} icon={AlertOctagon} color="slate" subtitle="All detected anomalies" />
        </button>

        <button
          onClick={() => setQuickFilter('HIGH')}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'HIGH' ? 'ring-2 ring-red-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="High Severity" value={highSeverityCount} icon={ShieldAlert} color="red" subtitle="Urgent supervisor review" />
        </button>

        <button
          onClick={() => setQuickFilter('WAITING')}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'WAITING' ? 'ring-2 ring-amber-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="Waiting Approval" value={waitingApprovalCount} icon={ClockAlert} color="amber" subtitle="Pending manager sign-off" />
        </button>

        <button
          onClick={() => setQuickFilter('RESOLVED')}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'RESOLVED' ? 'ring-2 ring-emerald-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="Resolved Cases" value={resolvedCount} icon={CheckCircle2} color="emerald" subtitle="Audited & completed" />
        </button>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardBody className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee, anomaly type, code, or department…"
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300 transition-colors bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="">Status: All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
              <option value="">Type: All</option>
              {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={selectClass}>
              <option value="">Severity: All</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Main Table with Separated Row Capsules for Clear Boundary Separation */}
      {loading ? (
        <Card><CardBody className="flex justify-center py-16"><Spinner size="lg" /></CardBody></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              illustration={<ComplianceShieldIllustration className="w-28 h-28" />}
              icon={AlertOctagon}
              title="No exceptions match your criteria"
              description={hasFilters ? 'Try adjusting your search filters or click reset.' : 'Run a scan from the dashboard to detect attendance anomalies.'}
              action={hasFilters ? (
                <button onClick={clearFilters} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  Reset all filters
                </button>
              ) : undefined}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-y-2.5">
            <thead>
              <tr className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-5 pb-1 text-left">Employee Record</th>
                <th className="px-5 pb-1 text-left">Department</th>
                <th className="px-5 pb-1 text-left">Anomaly Classification</th>
                <th className="px-5 pb-1 text-left">Severity</th>
                <th className="px-5 pb-1 text-left">Lifecycle Status</th>
                <th className="px-5 pb-1 text-left">Detected</th>
                <th className="px-5 pb-1 text-right">Investigation Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exc, idx) => {
                const cfg = getExceptionConfig(exc.exception_type);
                const IconComp = cfg.icon;
                const isHigh = exc.severity === 'HIGH';

                return (
                  <tr
                    key={`${exc.id}-${idx}`}
                    onClick={() => window.location.href = `/exceptions/${exc.id}`}
                    className="bg-white hover:bg-indigo-50/25 transition-all duration-150 group shadow-xs hover:shadow-md cursor-pointer"
                  >
                    {/* Leftmost Cell with Rounded Left Boundary & Left Border */}
                    <td className={clsx(
                      'px-5 py-3.5 rounded-l-2xl border-y-2 border-l-2 transition-colors',
                      isHigh ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-9 h-9 rounded-xl bg-gradient-to-br text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-xs ring-2 ring-white',
                          getAvatarBg(exc.department)
                        )}>
                          {getInitials(exc.employeeName)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {exc.employeeName}
                          </div>
                          <span className="inline-block mt-0.5 text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                            {exc.employeeCode}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isHigh ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        {exc.department || 'General'}
                      </span>
                    </td>

                    {/* Anomaly Classification with Vivid Category Icon */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isHigh ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border bg-white shadow-2xs">
                        <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', cfg.color)}>
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-slate-800 text-xs">
                          {exc.exception_type?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Severity */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isHigh ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      {exc.severity === 'HIGH' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300 shadow-2xs">
                          <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                          HIGH SEVERITY
                        </span>
                      ) : exc.severity === 'MEDIUM' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          MEDIUM
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          <Activity className="w-3.5 h-3.5 text-blue-600" />
                          LOW
                        </span>
                      )}
                    </td>

                    {/* Lifecycle Status */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isHigh ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      {statusBadge(exc.status)}
                    </td>

                    {/* Detected Date */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 text-xs text-slate-500 font-mono transition-colors',
                      isHigh ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      {new Date(exc.detected_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Rightmost Cell with Rounded Right Boundary & Right Border */}
                    <td className={clsx(
                      'px-5 py-3.5 rounded-r-2xl border-y-2 border-r-2 text-right transition-colors',
                      isHigh ? 'border-rose-300 bg-rose-50/15' : 'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <Link
                        href={`/exceptions/${exc.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-200" />
                        <span>Investigate</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
