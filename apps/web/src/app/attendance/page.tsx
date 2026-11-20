'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { PunchClockWidget } from '@/components/PunchClockWidget';
import { ClockPunchIllustration } from '@/components/ui/Illustrations';
import {
  Clock, Search, RefreshCw, AlertTriangle, CheckCircle2,
  Users, Filter, Sparkles, Laptop, Smartphone, Radio, X,
  Fingerprint, ScanFace, LogIn, LogOut, AlertOctagon, Timer,
  History, ClockAlert, ShieldAlert, Check, Building2
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

function formatLocal(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function durationHours(inUtc: string | null, outUtc: string | null): number | null {
  if (!inUtc || !outUtc) return null;
  return (new Date(outUtc).getTime() - new Date(inUtc).getTime()) / 3600000;
}

function getInitials(name: string): string {
  if (!name) return 'EM';
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

export default function AttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'FLAGGED' | 'MISSING_OUT' | 'RESOLVED'>('ALL');

  async function load() {
    setLoading(true);
    try {
      const r = await api.attendance({ limit: '200' });
      setRecords(r.records || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = records.filter((r) => {
    const matchSearch = !search || `${r.employeeName} ${r.department} ${r.employeeCode}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    
    let matchQuick = true;
    if (quickFilter === 'FLAGGED') matchQuick = r.status === 'FLAGGED';
    else if (quickFilter === 'MISSING_OUT') matchQuick = r.clock_in_utc && !r.clock_out_utc;
    else if (quickFilter === 'RESOLVED') matchQuick = r.status === 'RESOLVED' || r.status === 'VERIFIED';

    return matchSearch && matchStatus && matchQuick;
  });

  const totalRecords = records.length;
  const flagged = records.filter((r) => r.status === 'FLAGGED').length;
  const missingClockOut = records.filter((r) => r.clock_in_utc && !r.clock_out_utc).length;
  const resolved = records.filter((r) => r.status === 'RESOLVED' || r.status === 'VERIFIED').length;

  return (
    <div className="w-full max-w-[1536px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Attendance & Punch Records</h1>
            <Badge variant="indigo" className="font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Live Telemetry Feed
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Raw terminal punch telemetry, shift verification windows, and automated anomaly flagging
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-indigo-600")} />
            <span>Sync Telemetry</span>
          </button>
        </div>
      </div>

      {/* Web Punch Clock Widget */}
      <PunchClockWidget onPunchSuccess={load} />

      {/* KPI Stat Cards with Click-to-Filter and Vivid Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => { setQuickFilter('ALL'); setStatusFilter(''); }}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'ALL' && !statusFilter ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="Total Punches" value={totalRecords} icon={History} color="blue" subtitle="Verified timecard events" />
        </button>

        <button
          onClick={() => setQuickFilter('FLAGGED')}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'FLAGGED' ? 'ring-2 ring-amber-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="Flagged Anomalies" value={flagged} icon={AlertOctagon} color="amber" subtitle="Requires AI investigation" />
        </button>

        <button
          onClick={() => setQuickFilter('MISSING_OUT')}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'MISSING_OUT' ? 'ring-2 ring-red-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="Missing Clock-Out" value={missingClockOut} icon={ClockAlert} color="red" subtitle="Incomplete punch cycle" />
        </button>

        <button
          onClick={() => setQuickFilter('RESOLVED')}
          className={clsx(
            'text-left transition-all rounded-2xl cursor-pointer p-0.5',
            quickFilter === 'RESOLVED' ? 'ring-2 ring-emerald-500 shadow-md' : 'hover:scale-[1.01]'
          )}
        >
          <StatCard label="Resolved & Audited" value={resolved} icon={CheckCircle2} color="emerald" subtitle="Audited & manager approved" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardBody className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name, code, or department…"
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

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'FLAGGED', label: 'Flagged Only' },
              { id: 'MISSING_OUT', label: 'Missing Clock-Out' },
              { id: 'RESOLVED', label: 'Resolved' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setQuickFilter(chip.id as any)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap',
                  quickFilter === chip.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {chip.label}
              </button>
            ))}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 cursor-pointer ml-1"
            >
              <option value="">Status: All</option>
              <option value="RECORDED">RECORDED</option>
              <option value="FLAGGED">FLAGGED</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="VERIFIED">VERIFIED</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Main Records Table with Distinct Separated Row Capsules */}
      {loading ? (
        <Card><CardBody className="flex justify-center py-16"><Spinner size="lg" /></CardBody></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              illustration={<ClockPunchIllustration className="w-28 h-28" />}
              icon={Clock}
              title="No attendance records match your filter"
              description="Adjust your search terms or filter selection to view matching punch entries."
              action={
                (search || statusFilter || quickFilter !== 'ALL') ? (
                  <button
                    onClick={() => { setSearch(''); setStatusFilter(''); setQuickFilter('ALL'); }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Reset all filters
                  </button>
                ) : undefined
              }
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
                <th className="px-5 pb-1 text-left">Clock In</th>
                <th className="px-5 pb-1 text-left">Clock Out</th>
                <th className="px-5 pb-1 text-left">Shift Duration</th>
                <th className="px-5 pb-1 text-left">Status</th>
                <th className="px-5 pb-1 text-left">Terminal Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec, idx) => {
                const isMissingOut = rec.clock_in_utc && !rec.clock_out_utc;
                const isFlagged = rec.status === 'FLAGGED';
                const hrs = durationHours(rec.clock_in_utc, rec.clock_out_utc);

                return (
                  <tr
                    key={`${rec.id}-${idx}`}
                    className={clsx(
                      'transition-all duration-150 group shadow-xs hover:shadow-md bg-white',
                      isFlagged ? 'hover:bg-amber-50/30' :
                      isMissingOut ? 'hover:bg-red-50/20' :
                      'hover:bg-indigo-50/20'
                    )}
                  >
                    {/* Leftmost: Employee Info with Avatar */}
                    <td className={clsx(
                      'px-5 py-3.5 rounded-l-2xl border-y-2 border-l-2 transition-colors',
                      isFlagged ? 'border-amber-300 bg-amber-50/20' :
                      isMissingOut ? 'border-red-300 bg-red-50/15' :
                      'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-9 h-9 rounded-xl bg-gradient-to-br text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-xs ring-2 ring-white',
                          getAvatarBg(rec.department)
                        )}>
                          {getInitials(rec.employeeName)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {rec.employeeName}
                          </div>
                          <span className="inline-block mt-0.5 text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                            {rec.employeeCode}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isFlagged ? 'border-amber-300 bg-amber-50/20' :
                      isMissingOut ? 'border-red-300 bg-red-50/15' :
                      'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        {rec.department || 'General'}
                      </span>
                    </td>

                    {/* Clock In */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isFlagged ? 'border-amber-300 bg-amber-50/20' :
                      isMissingOut ? 'border-red-300 bg-red-50/15' :
                      'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-medium">
                        <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                        {formatLocal(rec.clock_in_utc)}
                      </div>
                    </td>

                    {/* Clock Out */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isFlagged ? 'border-amber-300 bg-amber-50/20' :
                      isMissingOut ? 'border-red-300 bg-red-50/15' :
                      'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      {rec.clock_out_utc ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-mono font-medium">
                          <LogOut className="w-3.5 h-3.5 text-indigo-600" />
                          {formatLocal(rec.clock_out_utc)}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-xs">
                          <AlertOctagon className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                          Missing Punch Out
                        </span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isFlagged ? 'border-amber-300 bg-amber-50/20' :
                      isMissingOut ? 'border-red-300 bg-red-50/15' :
                      'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      {hrs !== null ? (
                        <div className="flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-slate-400" />
                          <span className={clsx(
                            'font-semibold px-2 py-0.5 rounded-md font-mono text-xs border',
                            hrs > 8.5 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            hrs < 7.0 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          )}>
                            {hrs.toFixed(1)} hrs {hrs > 8.5 && '⚠️ OT'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic font-mono">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className={clsx(
                      'px-5 py-3.5 border-y-2 transition-colors',
                      isFlagged ? 'border-amber-300 bg-amber-50/20' :
                      isMissingOut ? 'border-red-300 bg-red-50/15' :
                      'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      {rec.status === 'FLAGGED' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                          FLAGGED
                        </span>
                      ) : rec.status === 'RESOLVED' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          RESOLVED
                        </span>
                      ) : rec.status === 'VERIFIED' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          <Check className="w-3 h-3 text-blue-600" />
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          RECORDED
                        </span>
                      )}
                    </td>

                    {/* Rightmost: Terminal Source with High-End Icons */}
                    <td className={clsx(
                      'px-5 py-3.5 rounded-r-2xl border-y-2 border-r-2 transition-colors',
                      isFlagged ? 'border-amber-300 bg-amber-50/20' :
                      isMissingOut ? 'border-red-300 bg-red-50/15' :
                      'border-slate-200/90 group-hover:border-indigo-300'
                    )}>
                      <div className="flex items-center gap-2">
                        {rec.source === 'WEB_PUNCH' ? (
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0" title="Web Punch Portal">
                            <Laptop className="w-3.5 h-3.5" />
                          </div>
                        ) : rec.source === 'MOBILE_APP' ? (
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0" title="Mobile App (GPS Verified)">
                            <Smartphone className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0" title="Biometric Fingerprint Scanner">
                            <Fingerprint className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="font-semibold text-xs text-slate-700">{rec.source?.replace(/_/g, ' ') || 'BIOMETRIC SCAN'}</span>
                      </div>
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
