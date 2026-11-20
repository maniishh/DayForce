'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ComplianceShieldIllustration } from '@/components/ui/Illustrations';
import {
  FileText, CheckCircle2, AlertCircle, BookOpen, Search, Hash, Calendar,
  UploadCloud, Plus, Layers, Sparkles, FileCode, ArrowRight, HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';

const TEMPLATES = [
  {
    label: 'Missing Clock-Out Remediation',
    title: 'Missing Punch and Clock-Out Remediation Policy',
    category: 'ATTENDANCE_AND_PUNCTUALITY',
    content: `# Missing Punch and Clock-Out Remediation Policy

Section 1.0 — Purpose and Scope
This policy standardizes remediation procedures when an hourly employee neglects or is unable to record a terminal clock-out punch at the conclusion of their scheduled shift.

Section 2.0 — Manager Verification Requirements
When a missing clock-out anomaly is detected, the direct supervisor must verify the employee's physical or electronic departure time via objective secondary evidence, such as access badge logs, workstation active session logs, or direct employee confirmation.

Section 3.0 — Standardized Adjustment Procedure
If the departure time is uncontested and supported by secondary corroboration, the manager is authorized to approve an adjustment setting the clock-out timestamp to the scheduled shift end time. Adjustments exceeding 30 minutes beyond scheduled shift end require secondary review by HR Administration.

Section 4.0 — Human Approval and Auditability
All timecard modifications require explicit human manager sign-off with a stated business rationale. Automated silent changes by algorithmic agents are strictly prohibited. Every modification generates an immutable audit log entry.`,
  },
  {
    label: 'Grace Period & Tardiness Standard',
    title: 'Attendance Grace Periods and Tardiness Classification Policy',
    category: 'ATTENDANCE_AND_PUNCTUALITY',
    content: `# Attendance Grace Periods and Tardiness Classification Policy

Section 1.0 — Standard Grace Period
A standard 10-minute grace period applies to the start of all scheduled work shifts. Employees clocking in within 10 minutes past the scheduled shift start time shall not be subject to disciplinary tracking.

Section 2.0 — Categorization of Late Arrivals
Arrivals beyond the 10-minute grace window are classified into three severity tiers:
- Category 1 (11 to 30 minutes late): Minor tardiness. Logged for trend analysis; manager review recommended if recurring.
- Category 2 (31 to 60 minutes late): Moderate tardiness. Direct supervisor notification and formal justification required.
- Category 3 (More than 60 minutes late): Major attendance exception. Requires supervisor conference and HR formal review.

Section 3.0 — Excused Lateness Exceptions
Late arrivals resulting from verified transit emergencies, severe weather advisories, or pre-authorized medical appointments are eligible for administrative excuse upon manager approval.`,
  },
  {
    label: 'Overtime Authorization Standard',
    title: 'Daily Overtime Pre-Authorization and Review Policy',
    category: 'OVERTIME',
    content: `# Daily Overtime Pre-Authorization and Review Policy

Section 1.0 — Daily Overtime Definition
In accordance with company standards, all non-exempt hours worked in excess of 8 standard hours in a single 24-hour workday constitute daily overtime and require departmental authorization.

Section 2.0 — Pre-Authorization Mandate
Overtime must be authorized in advance by the employee's designated manager. Unscheduled overtime resulting from operational emergencies must be submitted for manager retroactive review within 24 hours.

Section 3.0 — AI Exception Resolution Rules
When an employee's total daily recorded duration exceeds 8 hours, the AI assistant shall flag the record as an OVERTIME_REVIEW exception. The AI investigation agent must calculate exact hours worked, subtract scheduled meal breaks (minimum 30 minutes), and present a structured recommendation for manager approval.`,
  },
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [chunks,   setChunks]   = useState<any[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [search,   setSearch]   = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'chunks'>('content');

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('ATTENDANCE_AND_PUNCTUALITY');
  const [version, setVersion] = useState('1.0');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('ALL');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { success, error: showError } = useToast();

  async function loadPolicies(selectId?: string) {
    try {
      setLoading(true);
      const res = await api.policies();
      const docs = res.documents || [];
      setPolicies(docs);

      if (selectId) {
        const found = docs.find((d: any) => d.id === selectId);
        if (found) loadPolicyDetail(found);
      } else if (docs.length > 0 && !selected) {
        loadPolicyDetail(docs[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPolicyDetail(doc: any) {
    setSelected(doc);
    setChunksLoading(true);
    try {
      const res = await api.policy(doc.id);
      setSelected(res.document);
      setChunks(res.chunks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setChunksLoading(false);
    }
  }

  useEffect(() => {
    loadPolicies();
  }, []);

  function handleSelectTemplate(tpl: typeof TEMPLATES[0]) {
    setTitle(tpl.title);
    setCategory(tpl.category);
    setContent(tpl.content);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text);
    };
    reader.readAsText(file);
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showError('Validation Error', 'Please provide a title and policy content.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createPolicy({
        title,
        category,
        content,
        version,
        effectiveFrom,
        location,
      });

      success('Policy Uploaded & Ingested', res.message || `Policy '${title}' is now ready for RAG vector retrieval.`);
      setUploadModalOpen(false);
      // Reset form
      setTitle('');
      setContent('');
      // Reload list and select new doc
      loadPolicies(res.document?.id);
    } catch (err: any) {
      showError('Upload Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = policies.filter((p) =>
    !search || `${p.title} ${p.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full max-w-[1536px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Policy Knowledge Base</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload and manage organizational policies indexed by the RAG Vector Search & AI Evidence Agent
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 transition-all cursor-pointer"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload New Policy Document</span>
        </button>
      </div>

      {/* Info Banner: Explaining RAG & User Input */}
      <div className="bg-gradient-to-r from-indigo-50/80 via-violet-50/70 to-slate-50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed max-w-3xl">
            <span className="font-semibold text-slate-800">How Policies Power the AI Agents: </span>
            When an attendance exception occurs, the <strong>Policy RAG Agent</strong> extracts semantic query vectors and retrieves relevant clauses from these documents. The <strong>Resolution Planner Agent</strong> uses the citations to compute exact timecard corrections, while the <strong>Policy Reviewer Agent</strong> audits recommendations to strictly prevent ungrounded hallucinations.
          </div>
        </div>
        <div className="hidden md:flex flex-shrink-0">
          <ComplianceShieldIllustration className="w-16 h-16" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* List Column */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search policies by title or category…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300 transition-colors bg-white"
              />
            </div>

            <div className="space-y-2">
              {filtered.map((p) => {
                const isSelected = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => loadPolicyDetail(p)}
                    className={clsx(
                      'w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer',
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50/60 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                        p.ingestion_status === 'READY' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                      )}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{p.title}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="font-medium text-slate-600">{p.category?.replace(/_/g, ' ')}</span>
                          <span className="text-slate-300">·</span>
                          <span>v{p.version}</span>
                          {p.chunk_count && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-indigo-600 font-medium">{p.chunk_count} chunks</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <EmptyState
                  illustration={<ComplianceShieldIllustration className="w-24 h-24" />}
                  icon={FileText}
                  title="No policies found"
                  description="Upload a policy document to empower the RAG agents."
                  action={
                    <button
                      onClick={() => setUploadModalOpen(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      + Upload First Policy
                    </button>
                  }
                  className="py-8"
                />
              )}
            </div>
          </div>

          {/* Detail Column */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card className="sticky top-20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{selected.title}</h2>
                        <Badge variant="success">READY</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{selected.category}</span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />Version {selected.version}</span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Effective {selected.effective_from}</span>
                      </div>
                    </div>

                    {/* View Switcher: Raw Content vs RAG Vector Chunks */}
                    <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-0.5">
                      <button
                        onClick={() => setActiveTab('content')}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                          activeTab === 'content' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        <FileText className="w-3.5 h-3.5" /> Document Text
                      </button>
                      <button
                        onClick={() => setActiveTab('chunks')}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                          activeTab === 'chunks' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        )}
                      >
                        <Layers className="w-3.5 h-3.5" /> Vector Chunks ({chunks.length})
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardBody>
                  {activeTab === 'content' ? (
                    <div className="prose prose-sm prose-slate max-w-none">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 rounded-xl p-5 border border-slate-100 max-h-[500px] overflow-y-auto">
                        {selected.content || 'Content not available in this view.'}
                      </pre>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {chunksLoading ? (
                        <div className="flex justify-center py-8"><Spinner size="md" /></div>
                      ) : chunks.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">No chunks recorded for this document.</p>
                      ) : (
                        chunks.map((ch, idx) => (
                          <div key={ch.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-indigo-800">{ch.section}</span>
                              <span className="text-slate-400 font-mono">Chunk #{ch.chunk_index + 1}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-100">
                              &ldquo;{ch.text_snippet}&rdquo;
                            </p>
                            <div className="text-[10px] text-slate-400 flex items-center gap-3">
                              <span>Tokens: ~{ch.token_count || 100}</span>
                              <span>Indexed: Embeddings ready for vector search</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody>
                  <EmptyState
                    icon={BookOpen}
                    title="Select a policy"
                    description="Choose a policy document on the left or upload a new one to inspect its text and vector embeddings."
                  />
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Upload Policy Modal */}
      <Modal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload Organizational Policy Document"
        size="lg"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {/* Quick-fill Template Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quick-Fill from Standard Templates (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCode className="w-3 h-3" />
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Policy Document Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Attendance & Meal Break Policy 2026"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Policy Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="ATTENDANCE_AND_PUNCTUALITY">Attendance & Punctuality</option>
                <option value="OVERTIME">Overtime & Authorization</option>
                <option value="SHIFT_DIFFERENTIAL">Shift Differential & Overnight</option>
                <option value="LEAVE_AND_ABSENCE">Leave & Absence</option>
                <option value="CODE_OF_CONDUCT">General Code of Conduct</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Effective Date</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Applicable Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ALL or New York"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* File Picker helper */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Load from Local File (.txt, .md)
            </label>
            <input
              type="file"
              accept=".txt,.md,.markdown"
              onChange={handleFileUpload}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>

          {/* Policy Text Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Policy Content & Sections *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste policy markdown or sections here. Use 'Section X' or '# Section' to demarcate clauses for semantic RAG chunking..."
              rows={8}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300 resize-y"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-60 transition-all cursor-pointer"
            >
              {submitting ? <Spinner size="sm" /> : <UploadCloud className="w-4 h-4" />}
              {submitting ? 'Chunking & Ingesting…' : 'Ingest & Index Policy'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
