'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import {
  Clock, LogIn, LogOut, CheckCircle2, ShieldAlert, Sparkles,
  Calendar, UserCheck, AlertTriangle, Timer, Info
} from 'lucide-react';
import { clsx } from 'clsx';

interface PunchClockWidgetProps {
  onPunchSuccess?: () => void;
  compact?: boolean;
}

export function PunchClockWidget({ onPunchSuccess, compact = false }: PunchClockWidgetProps) {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [status, setStatus] = useState<{
    isClockedIn: boolean;
    currentRecord: any;
    lastRecord: any;
    employeeName?: string;
  } | null>(null);
  const [shiftInfo, setShiftInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const { success, error: showError } = useToast();
  const user = getUser();

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current punch and assigned shift status
  async function checkStatus() {
    try {
      const [punchRes, shiftRes] = await Promise.allSettled([
        api.punchStatus(),
        api.myShift(),
      ]);
      if (punchRes.status === 'fulfilled') setStatus(punchRes.value);
      if (shiftRes.status === 'fulfilled') setShiftInfo(shiftRes.value);
    } catch (err: any) {
      console.warn('Could not fetch punch status:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
  }, []);

  async function handlePunch(action: 'IN' | 'OUT') {
    setPunching(true);
    try {
      const res = await api.punch(action);
      success(
        action === 'IN' ? 'Punch In Successful!' : 'Punch Out Successful!',
        res.message || `Recorded at ${new Date().toLocaleTimeString()}`
      );
      await checkStatus();
      if (onPunchSuccess) onPunchSuccess();
    } catch (err: any) {
      showError('Punch Action Failed', err.message || 'Unable to record punch');
    } finally {
      setPunching(false);
    }
  }

  const isClockedIn = status?.isClockedIn ?? false;
  const clockInTime = status?.currentRecord?.clock_in_utc
    ? new Date(status.currentRecord.clock_in_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span className="font-mono text-sm font-semibold text-slate-800">{time || '--:--:--'}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        {isClockedIn ? (
          <button
            onClick={() => handlePunch('OUT')}
            disabled={punching}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200 transition-colors"
          >
            {punching ? <Spinner size="sm" /> : <LogOut className="w-3.5 h-3.5" />}
            Punch Out ({clockInTime})
          </button>
        ) : (
          <button
            onClick={() => handlePunch('IN')}
            disabled={punching}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            {punching ? <Spinner size="sm" /> : <LogIn className="w-3.5 h-3.5" />}
            Punch In
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden space-y-4">
      {/* Top Banner: Manager Assigned Shift Timings */}
      {shiftInfo?.shift && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-indigo-50/90 via-violet-50/60 to-slate-50 border border-indigo-100/90 rounded-xl text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>Assigned Shift: {shiftInfo.shift.startTimeLocal} – {shiftInfo.shift.endTimeLocal}</span>
                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 font-semibold rounded text-[10px]">
                  {shiftInfo.shift.shift_type || 'REGULAR'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                  Supervisor: <strong>{shiftInfo.manager?.name || 'Department Manager'}</strong>
                </span>
                <span>•</span>
                <span>Break: {shiftInfo.shift.break_minutes || 30}m</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
              <Info className="w-3 h-3 text-indigo-500" />
              10m Grace • 1.5x Duration auto-flag
            </span>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left: Clock and Live Time */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-slate-100 text-slate-700">
              Web Punch Clock
            </span>
            {isClockedIn ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Clocked In since {clockInTime}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Clocked Out
              </span>
            )}
          </div>

          <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900">
            {time || '--:--:--'}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {date} • America/New_York (EDT)
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {loading ? (
            <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <Spinner size="sm" />
              <span className="text-xs text-slate-500">Syncing punch status…</span>
            </div>
          ) : isClockedIn ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="text-right sm:text-left text-xs text-slate-500 hidden md:block">
                <div>Shift Status</div>
                <div className="font-semibold text-emerald-600">Active Shift</div>
              </div>
              <button
                onClick={() => handlePunch('OUT')}
                disabled={punching}
                className="flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-semibold text-sm rounded-xl shadow-sm shadow-rose-200 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
              >
                {punching ? <Spinner size="sm" /> : <LogOut className="w-4 h-4" />}
                Punch Out (End Shift)
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="text-right sm:text-left text-xs text-slate-500 hidden md:block">
                <div>Shift Status</div>
                <div className="font-semibold text-slate-700">Ready to start</div>
              </div>
              <button
                onClick={() => handlePunch('IN')}
                disabled={punching}
                className="flex items-center justify-center gap-2.5 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-sm rounded-xl shadow-sm shadow-emerald-200 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
              >
                {punching ? <Spinner size="sm" /> : <LogIn className="w-4 h-4" />}
                Punch In (Start Shift)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
