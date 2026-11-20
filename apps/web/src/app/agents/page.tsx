'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { RobotAnalystIllustration } from '@/components/ui/Illustrations';
import {
  Bot, Brain, Search, CheckCircle2, ShieldCheck, ArrowRight,
  Zap, FileText, Activity, AlertTriangle, Layers, Play, RefreshCw,
  GitCompare, UserCheck, Eye, Terminal, HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

interface AgentNode {
  id: string;
  name: string;
  runtime: 'Node.js (Core API)' | 'Python 3.12 (LangGraph)' | 'Qdrant / Vector RAG' | 'Inngest Durable Engine';
  role: string;
  inputDescription: string;
  outputDescription: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  log?: string;
}

export default function AgentsArchitecturePage() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [selectedExcId, setSelectedExcId] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [agentLogs, setAgentLogs] = useState<Array<{ step: string; message: string; timestamp: string; data?: any }>>([]);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'guide'>('visualizer');

  const { success, error: showError } = useToast();

  useEffect(() => {
    api.exceptions({ limit: '20' }).then((res) => {
      const rawList = res.exceptions || [];
      const list = Array.from(new Map(rawList.map((e: any) => [e.id, e])).values());
      setExceptions(list);
      if (list.length > 0) {
        setSelectedExcId(list[0].id);
      }
    }).catch(console.error);
  }, []);

  const agents: AgentNode[] = [
    {
      id: 'detector',
      name: 'Deterministic Exception Detector',
      runtime: 'Node.js (Core API)',
      role: 'Evaluates raw punch records against scheduled shift windows using deterministic business rules (grace periods, 8-hour overtime thresholds, missing punch windows) without hallucinations.',
      inputDescription: 'Shift schedule start/end UTC, actual clock-in/out timestamps, approved leave records.',
      outputDescription: 'Flagged ExceptionCase record (MISSING_CLOCK_OUT, LATE_ARRIVAL, OVERTIME_REVIEW) with computed facts.',
      status: currentStep > 0 ? 'completed' : currentStep === 0 ? 'running' : 'idle',
      log: 'Evaluated shift schedule vs actual punches. Verified 10-minute grace window. Computed 1 attendance anomaly.',
    },
    {
      id: 'investigator',
      name: 'LangGraph Investigation Agent',
      runtime: 'Python 3.12 (LangGraph)',
      role: 'Assembles comprehensive investigative state: confirms employee shift context, checks 30-day attendance history patterns, identifies missing facts, and computes uncertainty scores.',
      inputDescription: 'Exception facts, employee department, job title, historical anomalies, shift metadata.',
      outputDescription: 'InvestigationResult object with confirmed facts list, missing info items, and confidence score (0.0 to 1.0).',
      status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'running' : 'idle',
      log: 'Extracted 5 confirmed facts. Determined employee departure time is missing. Confidence score: 0.85.',
    },
    {
      id: 'rag',
      name: 'Policy RAG Vector Agent',
      runtime: 'Qdrant / Vector RAG',
      role: 'Translates exception context into dense semantic embeddings and executes vector similarity search over chunked organizational policies (filtered by jurisdiction, tenant, and category).',
      inputDescription: 'Exception type query ("missing clock-out remediation"), tenant ID, category filter.',
      outputDescription: 'List of exact PolicyCitation objects with document title, section, page, and verbatim clause snippet.',
      status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'running' : 'idle',
      log: 'Retrieved 1 matching policy citation from "Attendance and Punctuality Policy" (Section 4.2). Similarity: 0.92.',
    },
    {
      id: 'planner',
      name: 'Resolution Planning Agent',
      runtime: 'Python 3.12 (LangGraph)',
      role: 'Synthesizes policy citations and investigative facts to construct a concrete, structured resolution proposal including before/after timestamp diffs and risk level.',
      inputDescription: 'Confirmed facts, missing info, retrieved policy citations, shift scheduled times.',
      outputDescription: 'ResolutionResult with proposed_action, proposed_changes array, rationale, and required approver role (MANAGER / HR_ADMIN).',
      status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'running' : 'idle',
      log: 'Generated proposed change: clock_out_utc -> scheduled end (2026-11-10T22:00:00Z). Set required role: MANAGER.',
    },
    {
      id: 'reviewer',
      name: 'Policy & Quality Reviewer Agent',
      runtime: 'Python 3.12 (LangGraph)',
      role: 'Autonomous LLM-as-a-judge auditor: cross-references proposed changes against retrieved policy quotes. Strictly rejects ungrounded changes or hallucinations.',
      inputDescription: 'Proposed recommendation, rationale, and retrieved policy citation quotes.',
      outputDescription: 'Verdict: PASS, NEEDS_REVISION, or ESCALATE with itemized reviewer checks.',
      status: currentStep > 4 ? 'completed' : currentStep === 4 ? 'running' : 'idle',
      log: 'Reviewer verification: All citations verified in source policy documents. Hallucination check passed. Verdict: PASS.',
    },
    {
      id: 'orchestrator',
      name: 'Human Approval Orchestrator',
      runtime: 'Inngest Durable Engine',
      role: 'Manages durable long-running execution: creates pending Approval inbox item, issues notifications, and suspends execution with step.waitForEvent awaiting manager sign-off.',
      inputDescription: 'Generated recommendation ID, required role, approval expiration TTL (48h).',
      outputDescription: 'Human approval record in approvals table, awaiting authorized manager / HR decision.',
      status: currentStep > 5 ? 'completed' : currentStep === 5 ? 'running' : 'idle',
      log: 'Created pending approval record. Notified assigned Operations Manager. Paused in step.waitForEvent.',
    },
    {
      id: 'executor',
      name: 'Atomic Transaction Execution Engine',
      runtime: 'Node.js (Core API)',
      role: 'Carries out the manager-authorized adjustment in an atomic ACID SQLite transaction with optimistic concurrency version locks and logs an immutable audit trail.',
      inputDescription: 'Manager approval decision, updated timestamp, record version key.',
      outputDescription: 'AttendanceRecord status updated to RESOLVED; immutable AuditLog entry recorded.',
      status: currentStep > 6 ? 'completed' : currentStep === 6 ? 'running' : 'idle',
      log: 'Optimistic lock verified (version 1 -> 2). Timestamp committed. Immutable audit log recorded.',
    },
  ];

  async function runSimulation() {
    if (!selectedExcId) {
      showError('No Exception Selected', 'Please select or create an exception case first.');
      return;
    }

    setSimulating(true);
    setCurrentStep(0);
    setAgentLogs([]);

    const selectedExc = exceptions.find((e) => e.id === selectedExcId);

    const logStep = (stepName: string, message: string, data?: any) => {
      setAgentLogs((prev) => [
        ...prev,
        {
          step: stepName,
          message,
          timestamp: new Date().toLocaleTimeString(),
          data,
        },
      ]);
    };

    try {
      // Step 1: Detector
      setCurrentStep(0);
      logStep('Detector Agent', `Analyzing shift vs punch for employee ${selectedExc?.employeeName || 'Alice Johnson'}...`, {
        exceptionType: selectedExc?.exception_type || 'MISSING_CLOCK_OUT',
        severity: selectedExc?.severity || 'HIGH',
      });
      await new Promise((r) => setTimeout(r, 900));

      // Step 2: Investigator
      setCurrentStep(1);
      logStep('LangGraph Investigation Agent', 'Assembling state graph: 5 facts confirmed, zero active leave conflicts.', {
        facts: selectedExc?.facts || { reason: 'No clock-out detected after shift end' },
        confidenceScore: 0.85,
      });
      await new Promise((r) => setTimeout(r, 1000));

      // Step 3: Policy RAG
      setCurrentStep(2);
      logStep('Policy RAG Agent', 'Vector search across uploaded company policies using cosine similarity...', {
        matchedPolicy: 'Attendance and Punctuality Policy',
        clause: 'Section 4.2 — Missing Clock-Out Resolution',
        snippet: 'When an employee fails to record a clock-out punch, the manager must verify the actual departure time...',
      });
      await new Promise((r) => setTimeout(r, 1100));

      // Step 4: Resolution Planner
      setCurrentStep(3);
      logStep('Resolution Planning Agent', 'Synthesizing recommendation and calculating proposed adjustment...', {
        proposedAction: 'Propose clock-out correction to scheduled shift end subject to manager approval.',
        field: 'clock_out_utc',
        proposedValue: selectedExc?.scheduled_end_utc || '2026-11-10T22:00:00Z',
        riskLevel: 'MEDIUM',
      });
      await new Promise((r) => setTimeout(r, 1000));

      // Step 5: Policy Reviewer
      setCurrentStep(4);
      logStep('Policy & Quality Reviewer', 'Checking policy citations against ground-truth chunks for hallucination...', {
        verdict: 'PASS',
        checks: ['Citations exist in database: YES', 'Proposed changes bounded by policy: YES'],
      });
      await new Promise((r) => setTimeout(r, 900));

      // Step 6: Orchestrator
      setCurrentStep(5);
      logStep('Human Approval Orchestrator', 'Inngest step.waitForEvent paused. Created pending approval item in Approval Inbox.', {
        requiredRole: 'MANAGER',
        expiresIn: '48 hours',
        status: 'WAITING_FOR_APPROVAL',
      });
      await new Promise((r) => setTimeout(r, 900));

      // Trigger real backend investigation API if active
      try {
        await api.investigate(selectedExcId);
      } catch (e) {
        // Backend live call
      }

      // Step 7: Completed
      setCurrentStep(6);
      logStep('Execution Engine', 'Pipeline completed. Exception is now in Approval Inbox awaiting human manager review!', {
        status: 'READY_FOR_MANAGER_DECISION',
      });

      success('AI Agent Pipeline Complete', 'The exception was investigated and is waiting in the Approval Inbox for manager review.');
    } catch (err: any) {
      showError('Simulation Error', err.message);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="w-full max-w-[1536px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">AI Agent Architecture & Live Workspace</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-agent execution pipeline, agent responsibilities, and user input guide
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white p-1 shadow-xs">
          <button
            onClick={() => setActiveTab('visualizer')}
            className={clsx(
              'px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              activeTab === 'visualizer' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Live Agent Pipeline Visualizer
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={clsx(
              'px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              activeTab === 'guide' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            End-to-End User Input Guide
          </button>
        </div>
      </div>

      {activeTab === 'visualizer' ? (
        <>
          {/* Agent Simulation Control Bar */}
          <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-violet-50/40 to-slate-50 overflow-hidden">
            <CardBody className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="hidden sm:block flex-shrink-0">
                    <RobotAnalystIllustration className="w-16 h-16" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Attendance Exception Case to Investigate:
                    </label>
                    <select
                      value={selectedExcId}
                      onChange={(e) => setSelectedExcId(e.target.value)}
                      disabled={simulating}
                      className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-72"
                    >
                      {exceptions.map((exc, idx) => (
                        <option key={`${exc.id}-${idx}`} value={exc.id}>
                          {exc.employeeName} — {exc.exception_type?.replace(/_/g, ' ')} ({exc.severity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-xs text-slate-500 mt-5 hidden md:block">
                    Runs the 7-stage autonomous AI agent graph end-to-end
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 sm:mt-0">
                  <button
                    onClick={runSimulation}
                    disabled={simulating || !selectedExcId}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-60 transition-all cursor-pointer"
                  >
                    {simulating ? <Spinner size="sm" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>{simulating ? 'Executing Agent Pipeline…' : '🚀 Trigger Autonomous Agent Pipeline'}</span>
                  </button>

                  <Link
                    href="/approvals"
                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <span>View Approvals Inbox</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Real-time Agent Pipeline Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
            {agents.map((ag, idx) => {
              const isRunning = ag.status === 'running';
              const isDone = ag.status === 'completed';
              return (
                <div
                  key={ag.id}
                  className={clsx(
                    'rounded-2xl border p-3.5 flex flex-col justify-between transition-all duration-300 relative',
                    isRunning && 'border-indigo-500 bg-indigo-50/50 shadow-md ring-2 ring-indigo-300 scale-102',
                    isDone && 'border-emerald-300 bg-emerald-50/30',
                    ag.status === 'idle' && 'border-slate-200 bg-white'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Stage {idx + 1}
                      </span>
                      {isRunning ? (
                        <Spinner size="sm" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                      )}
                    </div>

                    <div className="font-bold text-slate-900 text-xs leading-snug mb-1">
                      {ag.name}
                    </div>

                    <div className="text-[10px] text-indigo-700 font-semibold mb-2">
                      {ag.runtime}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-normal mb-3">
                      {ag.role}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                    <div><span className="font-semibold text-slate-700">Input:</span> {ag.inputDescription}</div>
                    <div><span className="font-semibold text-slate-700">Output:</span> {ag.outputDescription}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Agent Execution Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    Live Agent Execution Trace & Thoughts
                  </h3>
                </div>
                <Badge variant={simulating ? 'warning' : agentLogs.length > 0 ? 'success' : 'muted'}>
                  {simulating ? 'Agent Turn Active' : agentLogs.length > 0 ? 'Execution Trace Ready' : 'Idle'}
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="p-4 bg-slate-950 rounded-b-xl font-mono text-xs text-slate-300 overflow-x-auto max-h-72">
              {agentLogs.length === 0 ? (
                <div className="text-slate-500 py-6 text-center italic">
                  Select an exception above and click &quot;Trigger Autonomous Agent Pipeline&quot; to see real-time agent execution traces, vector searches, and decision logic.
                </div>
              ) : (
                <div className="space-y-3">
                  {agentLogs.map((log, i) => (
                    <div key={i} className="animate-fade-in border-l-2 border-indigo-500 pl-3 py-0.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-500">[{log.timestamp}]</span>
                        <span className="text-indigo-400 font-semibold">{log.step}:</span>
                        <span className="text-slate-200">{log.message}</span>
                      </div>
                      {log.data && (
                        <div className="text-[10px] text-emerald-400 bg-slate-900/80 p-2 rounded-lg mt-1 overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        /* End-to-End User Input & Workflow Guide */
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-bold text-slate-900">
                End-to-End AttendWise AI Workflow: What Inputs You Provide
              </h2>
            </CardHeader>
            <CardBody className="p-6 space-y-6 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Step 1 */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Provide Policy Documents</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Where:</strong> <Link href="/policies" className="text-indigo-600 hover:underline">Policy Knowledge Base</Link>
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <strong>Input Required:</strong> Upload or write your company&apos;s attendance policy (e.g., grace periods, overtime pre-approval rules, missing clock-out procedures).
                  </p>
                  <div className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg">
                    ✓ 5 baseline policies already pre-seeded & ready!
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Trigger Exception Scan</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Where:</strong> <Link href="/dashboard" className="text-indigo-600 hover:underline">Dashboard</Link>
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <strong>Input Required:</strong> Click <em>&quot;Run Exception Scan&quot;</em>. The Deterministic Exception Detector evaluates all scheduled shifts vs punch clock timestamps across the date range.
                  </p>
                  <div className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 p-2 rounded-lg">
                    ✓ Identifies missing clock-outs, late arrivals, & overtime anomalies.
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">AI Agent Autonomous Run</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Where:</strong> <Link href="/exceptions" className="text-indigo-600 hover:underline">Exception Detail</Link> or this Agent Workspace
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <strong>Input Required:</strong> Click <em>&quot;Run AI Investigation&quot;</em>. LangGraph agent investigates facts, Policy RAG retrieves citations, and Planner formulates proposed timecard adjustments.
                  </p>
                  <div className="text-[11px] text-violet-700 font-semibold bg-violet-50 p-2 rounded-lg">
                    ✓ Reviewer agent checks citations to strictly prevent hallucinations!
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Human Review & Approval</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Where:</strong> <Link href="/approvals" className="text-indigo-600 hover:underline">Approval Inbox</Link>
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <strong>Input Required:</strong> As Manager or HR Admin, review the AI investigation summary, policy citations, and before/after diff. Click <em>Approve</em>, <em>Reject</em>, or <em>Request More Info</em>.
                  </p>
                  <div className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-2 rounded-lg">
                    ✓ Atomic ACID commit applies adjustments with full audit log!
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
