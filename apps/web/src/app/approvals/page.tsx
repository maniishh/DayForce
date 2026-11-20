'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardBody } from '@/components/ui/card';
import { Badge, severityBadge, statusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/modal';
import { EmptyInboxIllustration } from '@/components/ui/Illustrations';
import {
  CheckCircle2, XCircle, MessageSquare, RefreshCw,
  Lock, ArrowRight, Shield, AlertTriangle, Sparkles, Filter
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

function toArray<T = any>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function ApprovalsPage() {
  const [approvals,  setApprovals]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusTab,  setStatusTab]  = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');
  const [active,     setActive]     = useState<any | null>(null);
  const [decision,   setDecision]   = useState('');
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const user = getUser();
  const { success, error: showError } = useToast();

  const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'HR_ADMIN' || user?.role === 'SYSTEM_ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  async function load() {
    setLoading(true);
    try {
      const r = await api.approvals(statusTab === 'ALL' ? undefined : statusTab);
      setApprovals(r.approvals || []);
    } catch (e: any) {
      console.error('Approvals fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleScanAndPopulate() {
    setGenerating(true);
    try {
      const today = new Date();
      const start = new Date(today); start.setDate(today.getDate() - 14);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const res = await api.scan(fmt(start), fmt(today));
      success('Scan Complete', `Detected ${res.exceptions} exceptions and created active approvals.`);
      await load();
    } catch (err: any) {
      showError('Scan Failed', err.message);
    } finally {
      setGenerating(false);
    }
  }

  function prepareSubmit() {
    if (!active || !decision) return;
    if (decision === 'REJECT' && !comment) {
      showError('Comment Required', 'Please provide a reason for rejection.');
      return;
    }
    setConfirmOpen(true);
  }

  async function submit() {
    if (!active || !decision) return;
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      await api.submitDecision(active.id, decision, comment);
      success(
        'Decision Recorded',
        `${decision.replace(/_/g, ' ')} for ${active.employeeName}'s exception.`
      );
      setActive(null); setDecision(''); setComment('');
      load();
    } catch (e: any) { showError('Decision Failed', e.message); }
    setSubmitting(false);
  }

  useEffect(() => { load(); }, [statusTab]);

  const decisionMeta: Record<string, { color: string; activeColor: string; icon: React.ElementType }> = {
    APPROVE:           { color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50', activeColor: 'bg-emerald-600 text-white border-emerald-600', icon: CheckCircle2 },
    REJECT:            { color: 'border-red-200 text-red-700 hover:bg-red-50',             activeColor: 'bg-red-600 text-white border-red-600',         icon: XCircle },
    REQUEST_MORE_INFO: { color: 'border-indigo-200 text-indigo-700 hover:bg-indigo-50',    activeColor: 'bg-indigo-600 text-white border-indigo-600',   icon: MessageSquare },
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        title={`Confirm: ${decision.replace(/_/g, ' ')}`}
        message={`You are about to ${decision.toLowerCase().replace(/_/g, ' ')} the exception for ${active?.employeeName}. This action will be recorded in the audit trail.`}
        confirmLabel={decision.replace(/_/g, ' ')}
        variant={decision === 'REJECT' ? 'danger' : 'primary'}
        loading={submitting}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEmployee ? 'Your Exception Approvals' : 'Approval Inbox'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEmployee
              ? 'Track the status and manager resolution of your attendance exceptions'
              : `${approvals.length} ${statusTab.toLowerCase()} decision${approvals.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['PENDING', 'APPROVED', 'ALL'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusTab(tab)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all',
                  statusTab === tab
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {tab.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Quick Scan to Populate */}
          {isManagerOrAdmin && (
            <button
              onClick={handleScanAndPopulate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors disabled:opacity-60"
            >
              {generating ? <Spinner size="sm" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
              {generating ? 'Scanning…' : 'Generate Approvals'}
            </button>
          )}

          <button
            onClick={load}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : approvals.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <EmptyState
              illustration={<EmptyInboxIllustration className="w-36 h-36" />}
              title={statusTab === 'PENDING' ? 'No pending approvals' : 'No records found'}
              description={
                statusTab === 'PENDING'
                  ? 'All caught up! You can run an AI scan to detect attendance exceptions and generate fresh approvals.'
                  : `There are currently no ${statusTab.toLowerCase()} approvals.`
              }
              action={
                isManagerOrAdmin ? (
                  <button
                    onClick={handleScanAndPopulate}
                    disabled={generating}
                    className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-60"
                  >
                    {generating ? <Spinner size="sm" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? 'Scanning attendance…' : 'Run AI Scan & Generate Approvals'}
                  </button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((apr, idx) => {
            const proposedChanges = toArray(apr.proposedChanges || apr.proposed_changes);
            return (
            <Card key={`${apr.id}-${idx}`} className="animate-slide-up" hover>
              <CardBody className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-base">{apr.employeeName}</span>
                      <Badge variant="muted">{apr.department}</Badge>
                      <Badge variant="muted">{apr.employeeCode}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm text-slate-600 font-medium">{apr.exception_type?.replace(/_/g, ' ')}</span>
                      {severityBadge(apr.severity)}
                      {statusBadge(apr.status)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400 flex-shrink-0 space-y-1">
                    <div>Requested {new Date(apr.requested_at).toLocaleDateString()}</div>
                    {apr.status === 'PENDING' && (
                      <div className="text-amber-600 font-medium">Expires {new Date(apr.expires_at).toLocaleDateString()}</div>
                    )}
                    <Badge variant="info">{apr.required_role?.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>

                {/* Proposed action */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">AI Proposed Action</div>
                  <p className="text-sm text-slate-700">{apr.proposed_action}</p>
                  {apr.rationale && (
                    <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-200 pt-2">{apr.rationale?.slice(0, 250)}</p>
                  )}
                </div>

                {/* Proposed changes diff */}
                {proposedChanges.length > 0 && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-amber-50 px-4 py-2 border-b border-amber-100">
                      <span className="text-xs font-semibold text-amber-700">Proposed Attendance Changes</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {proposedChanges.map((ch: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                          <span className="font-semibold text-slate-700 w-28 flex-shrink-0">{ch.field}</span>
                          <code className="bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 font-mono">{ch.current_value ?? 'null'}</code>
                          <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <code className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 font-mono">{ch.proposed_value}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision result or Action Panel */}
                {apr.status === 'APPROVED' ? (
                  <div className="bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-xl border border-emerald-200 text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Approved and applied to attendance record on {new Date(apr.decided_at || apr.requested_at).toLocaleDateString()}
                    </span>
                    <Link href={`/exceptions/${apr.exception_id}`} className="underline text-emerald-800">
                      View Exception
                    </Link>
                  </div>
                ) : isManagerOrAdmin ? (
                  active?.id === apr.id ? (
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <div className="flex gap-2">
                        {(['APPROVE', 'REJECT', 'REQUEST_MORE_INFO'] as const).map((d) => {
                          const meta = decisionMeta[d];
                          const Icon = meta.icon;
                          const isActive = decision === d;
                          return (
                            <button
                              key={d}
                              onClick={() => setDecision(d)}
                              className={clsx(
                                'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all',
                                isActive ? meta.activeColor : meta.color,
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {d.replace(/_/g, ' ')}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={decision === 'REJECT' ? 'Rejection reason (required)…' : 'Optional comment…'}
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none hover:border-slate-300 transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={prepareSubmit}
                          disabled={submitting || !decision}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-60 disabled:shadow-none transition-all"
                        >
                          {submitting ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
                          Submit Decision
                        </button>
                        <button
                          onClick={() => { setActive(null); setDecision(''); setComment(''); }}
                          className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => setActive(apr)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 transition-all"
                      >
                        <MessageSquare className="w-4 h-4" /> Review & Decide
                      </button>
                      <Link href={`/exceptions/${apr.exception_id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                        View full exception <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span>Awaiting Manager Review</span>
                    <Link href={`/exceptions/${apr.exception_id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                      View details <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </CardBody>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
