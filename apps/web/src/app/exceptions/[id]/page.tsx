'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, severityBadge, statusBadge } from '@/components/ui/badge';
import { ProgressSteps, Step } from '@/components/ui/progress-steps';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/modal';
import {
  ChevronLeft, Brain, FileText, CheckCircle2, AlertCircle,
  Clock, Zap, ArrowRight, XCircle, Ban, Quote, GitCompare, Shield
} from 'lucide-react';
import { clsx } from 'clsx';
import { getUser } from '@/lib/auth';

function formatUtc(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

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

function getLifecycleSteps(status: string): Step[] {
  const stages = ['DETECTED', 'INVESTIGATING', 'WAITING_FOR_APPROVAL', 'RESOLVED'];
  const labels = ['Detected', 'Investigating', 'Approval', 'Resolved'];
  const currentIdx = stages.indexOf(status);

  return labels.map((label, i) => ({
    label,
    status: i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'pending',
  }));
}

export default function ExceptionDetailPage() {
  const { id } = useParams() as { id: string };
  const router  = useRouter();
  const { success, error: showError } = useToast();
  const [data,     setData]     = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [invLoading, setInvLoading] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const user = getUser();
  const canInvestigate = user?.role === 'MANAGER' || user?.role === 'HR_ADMIN' || user?.role === 'SYSTEM_ADMIN';
  const canCancel = user?.role === 'HR_ADMIN' || user?.role === 'SYSTEM_ADMIN';

  async function load() {
    try {
      const d = await api.exception(id);
      setData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function triggerInvestigation() {
    setInvLoading(true);
    try {
      const res = await api.investigate(id);
      success('Investigation Completed', res.message || 'The AI pipeline analyzed this case and created an approval.');
      await load();
    } catch (e: any) { showError('Investigation Failed', e.message); }
    setInvLoading(false);
  }

  async function cancelException() {
    setCancelling(true);
    try {
      await api.cancelException(id, 'Manually cancelled by user');
      success('Exception Cancelled', 'This exception has been closed.');
      load();
    } catch (e: any) { showError('Cancel Failed', e.message); }
    setCancelling(false);
    setShowCancel(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="flex justify-center p-12 animate-fade-in">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-3">Loading exception…</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="p-6">
      <EmptyState icon={AlertCircle} title="Exception not found" description="This exception may have been deleted or you don't have access." />
    </div>
  );

  const { exception: exc, investigation: inv, recommendation: rec, approval, auditLogs } = data;
  const facts = (() => { try { return typeof exc?.facts === 'string' ? JSON.parse(exc.facts) : exc?.facts || {}; } catch { return {}; } })();
  const isTerminal = ['RESOLVED','CANCELLED','REJECTED'].includes(exc.status);

  const confirmedFacts = toArray(inv?.confirmed_facts || inv?.confirmedFacts);
  const missingInfo = toArray(inv?.missing_information || inv?.missing_info || inv?.missingInfo);
  const citations = toArray(rec?.citations || rec?.policy_citations);
  const proposedChanges = toArray(rec?.proposed_changes || rec?.proposedChanges);
  const safeAuditLogs = toArray(auditLogs);

  return (
    <div className="p-6 space-y-5 max-w-5xl animate-fade-in">
      <ConfirmDialog
        open={showCancel} onClose={() => setShowCancel(false)} onConfirm={cancelException}
        title="Cancel Exception" message="Are you sure you want to cancel this exception? This action cannot be undone."
        confirmLabel="Cancel Exception" variant="danger" loading={cancelling}
      />

      {/* Back + header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors mt-0.5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{exc.exception_type?.replace(/_/g,' ')}</h1>
            {severityBadge(exc.severity)}
            {statusBadge(exc.status)}
          </div>
          <p className="text-sm text-slate-500 mt-1">{exc.employeeName} · {exc.department} · {exc.employeeCode}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isTerminal && (
            <>
              {canCancel && (
                <button
                  onClick={() => setShowCancel(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
              {canInvestigate && (
                <button
                  onClick={triggerInvestigation}
                  disabled={invLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 dark:shadow-none disabled:opacity-60 disabled:shadow-none transition-all cursor-pointer"
                >
                  {invLoading ? <Spinner size="sm" /> : <Brain className="w-4 h-4" />}
                  {invLoading ? 'Triggering…' : 'Run AI Investigation'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lifecycle Progress */}
      <Card>
        <CardBody className="py-4 px-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lifecycle</span>
            <ProgressSteps steps={getLifecycleSteps(exc.status)} />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Facts */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Exception Facts</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Scheduled Start', formatUtc(exc.scheduled_start_utc), 'text-blue-700 bg-blue-50'],
                  ['Scheduled End',   formatUtc(exc.scheduled_end_utc), 'text-blue-700 bg-blue-50'],
                  ['Clock In',        formatUtc(exc.clock_in_utc), exc.clock_in_utc ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'],
                  ['Clock Out',       formatUtc(exc.clock_out_utc), exc.clock_out_utc ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'],
                  ['Detected',        formatUtc(exc.detected_at), 'text-amber-700 bg-amber-50'],
                  ['Resolved',        formatUtc(exc.resolved_at), exc.resolved_at ? 'text-emerald-700 bg-emerald-50' : ''],
                ].map(([k, v, colorClass]) => (
                  <div key={k as string} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-xs text-slate-500 font-medium mb-1">{k}</div>
                    <div className={clsx('text-sm font-semibold', v === '—' ? 'text-slate-400' : 'text-slate-800')}>
                      {v}
                    </div>
                  </div>
                ))}
              </div>
              {Object.keys(facts).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Computed Facts</div>
                  <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto">
                    {Object.entries(facts).map(([k, v]) => (
                      <div key={k} className="py-0.5">
                        <span className="text-indigo-400">{k}</span>
                        <span className="text-slate-500">: </span>
                        <span className="text-emerald-400">{JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI Investigation */}
          {inv && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-slate-800 text-sm">AI Investigation</h2>
                    <Badge variant="info">LangGraph</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500">Confidence</div>
                    <div className={clsx(
                      'text-sm font-bold',
                      (inv.confidence_score || 0) >= 0.8 ? 'text-emerald-600' :
                      (inv.confidence_score || 0) >= 0.5 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {((inv.confidence_score || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-sm text-slate-700 leading-relaxed bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                  {inv.summary}
                </p>

                {confirmedFacts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed Facts
                    </div>
                    <ul className="space-y-1.5">
                      {confirmedFacts.map((f: string, i: number) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-2 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {missingInfo.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-2">
                      <AlertCircle className="w-3.5 h-3.5" /> Missing Information
                    </div>
                    <ul className="space-y-1.5">
                      {missingInfo.map((m: string, i: number) => (
                        <li key={i} className="text-xs text-amber-700 flex gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* Recommendation */}
          {rec && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-slate-800 text-sm">AI Recommendation</h2>
                  </div>
                  <Badge variant={rec.risk_level === 'HIGH' ? 'danger' : rec.risk_level === 'MEDIUM' ? 'warning' : 'success'}>
                    {rec.risk_level} RISK
                  </Badge>
                </div>
              </CardHeader>
              <CardBody className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1.5">Type</div>
                    <Badge variant="info">{rec.recommendation_type?.replace(/_/g,' ')}</Badge>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1.5">Proposed Action</div>
                    <p className="text-sm text-slate-700 font-medium">{rec.proposed_action}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-1.5">Rationale</div>
                  <p className="text-sm text-slate-600 leading-relaxed">{rec.rationale}</p>
                </div>

                {/* Policy Citations */}
                {citations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-3">
                      <Quote className="w-3.5 h-3.5" /> Policy Citations ({citations.length})
                    </div>
                    <div className="space-y-2">
                      {citations.map((cit: any, i: number) => (
                        <div key={i} className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4 text-xs">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="font-semibold text-indigo-800">{cit.document_title}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-indigo-600">{cit.section}</span>
                          </div>
                          <p className="text-slate-600 italic border-l-2 border-indigo-300 pl-3">
                            &ldquo;{cit.snippet?.slice(0, 300)}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proposed Changes - Side by Side Diff */}
                {proposedChanges.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-3">
                      <GitCompare className="w-3.5 h-3.5" /> Proposed Changes ({proposedChanges.length})
                    </div>
                    <div className="space-y-3">
                      {proposedChanges.map((ch: any, i: number) => (
                        <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                            <span className="text-xs font-bold text-slate-700">{ch.field}</span>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-slate-200">
                            <div className="p-3 bg-red-50/50">
                              <div className="text-[10px] uppercase font-semibold text-red-500 mb-1">Before</div>
                              <code className="text-xs text-red-700 font-mono">{ch.current_value ?? 'null'}</code>
                            </div>
                            <div className="p-3 bg-emerald-50/50">
                              <div className="text-[10px] uppercase font-semibold text-emerald-500 mb-1">After</div>
                              <code className="text-xs text-emerald-700 font-mono">{ch.proposed_value}</code>
                            </div>
                          </div>
                          {ch.rationale && (
                            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 italic">
                              {ch.rationale}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Approval status */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Approval Status</h2>
              </div>
            </CardHeader>
            <CardBody>
              {!approval ? (
                <EmptyState icon={CheckCircle2} title="No approval yet" description="Run AI investigation to generate a recommendation" className="py-4" />
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status</span>
                    {statusBadge(approval.status)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Role required</span>
                    <span className="font-semibold text-slate-700">{approval.required_role?.replace(/_/g, ' ')}</span>
                  </div>
                  {approval.decision && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Decision</span>
                      <Badge variant={approval.decision === 'APPROVE' ? 'success' : 'danger'}>
                        {approval.decision}
                      </Badge>
                    </div>
                  )}
                  {approval.decision_comment && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mt-2">
                      <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Comment</div>
                      <p className="text-slate-600 italic">{approval.decision_comment}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Expires</span>
                    <span className="font-medium">{new Date(approval.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Audit Log */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-800 text-sm">Audit Trail</h2>
            </CardHeader>
            <CardBody>
              {!safeAuditLogs.length ? (
                <EmptyState icon={Shield} title="No audit events" className="py-4" />
              ) : (
                <div className="space-y-0">
                  {safeAuditLogs.map((log: any, idx: number) => (
                    <div key={log.id} className="relative flex gap-3 py-2.5">
                      <div className="relative flex flex-col items-center">
                        <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full ring-4 ring-indigo-50 flex-shrink-0 z-10" />
                        {idx < auditLogs.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="text-xs font-semibold text-slate-700">{log.action.replace(/_/g,' ')}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</div>
                        {log.reason && <div className="text-[11px] text-slate-500 mt-1 italic">{log.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
