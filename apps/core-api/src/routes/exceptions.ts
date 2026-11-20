import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAll, queryOne, execute } from '../db/index.js';
import { publishEvent } from '../events/publisher.js';
import { runInvestigationPipeline } from '../domain/investigationRunner.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/exceptions
router.get('/', (req: Request, res: Response): void => {
  const { status, type, severity, employeeId, page = '1', limit = '20' } = req.query;
  const tenantId = req.user!.tenantId;
  const pageNum = Math.max(1, parseInt(page as string));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
  const offset = (pageNum - 1) * limitNum;

  let sql = `
    SELECT ec.*,
           e.first_name || ' ' || e.last_name AS employeeName,
           e.employee_code AS employeeCode,
           e.department,
           s.scheduled_start_utc, s.scheduled_end_utc,
           inv.summary AS investigationSummary,
           inv.confidence_score AS confidenceScore,
           rec.proposed_action AS recommendedAction,
           rec.recommendation_type AS recommendationType,
           rec.risk_level AS riskLevel
    FROM exception_cases ec
    JOIN employees e ON ec.employee_id = e.id
    LEFT JOIN shifts s ON ec.shift_id = s.id
    LEFT JOIN (
      SELECT exception_id, summary, confidence_score
      FROM investigations
      GROUP BY exception_id
      HAVING MAX(created_at)
    ) inv ON ec.id = inv.exception_id
    LEFT JOIN (
      SELECT exception_id, proposed_action, recommendation_type, risk_level
      FROM recommendations
      WHERE status = 'PENDING'
      GROUP BY exception_id
      HAVING MAX(created_at)
    ) rec ON ec.id = rec.exception_id
    WHERE ec.tenant_id = ?
  `;
  const params: any[] = [tenantId];

  // Role-scoped access
  if (req.user!.role === 'EMPLOYEE') {
    const emp = queryOne<any>('SELECT id FROM employees WHERE user_id = ?', [req.user!.id]);
    if (emp) { sql += ' AND ec.employee_id = ?'; params.push(emp.id); }
  } else if (req.user!.role === 'MANAGER') {
    const mgr = queryOne<any>('SELECT id FROM employees WHERE user_id = ?', [req.user!.id]);
    if (mgr) { sql += ' AND (ec.assigned_manager_id = ? OR ec.assigned_manager_id IS NULL)'; params.push(mgr.id); }
  }

  if (status)     { sql += ' AND ec.status = ?';         params.push(status); }
  if (type)       { sql += ' AND ec.exception_type = ?'; params.push(type); }
  if (severity)   { sql += ' AND ec.severity = ?';       params.push(severity); }
  if (employeeId) { sql += ' AND ec.employee_id = ?';    params.push(employeeId); }

  // Count
  const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/LEFT JOIN.*?$/s, `WHERE ec.tenant_id = ?${status ? ' AND ec.status = ?' : ''}${type ? ' AND ec.exception_type = ?' : ''}${severity ? ' AND ec.severity = ?' : ''}`);

  sql += ` GROUP BY ec.id ORDER BY 
    CASE ec.severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
    ec.detected_at DESC
    LIMIT ? OFFSET ?`;
  params.push(limitNum, offset);

  const rows = queryAll<any>(sql, params);
  const exceptions = rows.map((r) => ({
    ...r,
    facts: JSON.parse(r.facts_json || r.facts || '{}'),
  }));

  res.json({ exceptions, page: pageNum, limit: limitNum, total: exceptions.length });
});

// GET /api/v1/exceptions/:id
router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params as { id: string };
  const tenantId = req.user!.tenantId;

  const exc = queryOne<any>(
    `SELECT ec.*,
            e.first_name || ' ' || e.last_name AS employeeName,
            e.employee_code AS employeeCode, e.department, e.job_title,
            e.timezone AS employeeTimezone,
            s.scheduled_start_utc, s.scheduled_end_utc, s.shift_type,
            s.break_minutes, s.timezone AS shiftTimezone,
            ar.clock_in_utc, ar.clock_out_utc, ar.source AS attendanceSource,
            ar.version AS attendanceVersion
     FROM exception_cases ec
     JOIN employees e ON ec.employee_id = e.id
     LEFT JOIN shifts s ON ec.shift_id = s.id
     LEFT JOIN attendance_records ar ON ec.attendance_record_id = ar.id
     WHERE ec.id = ? AND ec.tenant_id = ?`,
    [id, tenantId]
  );

  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }

  // For employees, allow viewing own exceptions or team cases in read-only mode
  const isOwner = req.user!.role !== 'EMPLOYEE' || exc.employee_id === req.user!.employeeId;

  const investigation = queryOne<any>(
    'SELECT * FROM investigations WHERE exception_id = ? ORDER BY created_at DESC LIMIT 1', [id]
  );
  const recommendation = queryOne<any>(
    "SELECT * FROM recommendations WHERE exception_id = ? ORDER BY created_at DESC LIMIT 1", [id]
  );
  const approval = queryOne<any>(
    "SELECT * FROM approvals WHERE exception_id = ? ORDER BY requested_at DESC LIMIT 1", [id]
  );
  const auditLogs = queryAll<any>(
    "SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT 20", [id]
  );

  const safeJsonParse = (val: any, fallback: any = []) => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val !== 'string') return val;
    try {
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const parsedConfirmedFacts = safeJsonParse(investigation?.confirmed_facts_json || investigation?.confirmed_facts, []);
  const parsedMissingInfo = safeJsonParse(investigation?.missing_info_json || investigation?.missing_info, []);
  const parsedConflicts = safeJsonParse(investigation?.conflicts_json || investigation?.conflicts, []);

  const parsedProposedChanges = safeJsonParse(recommendation?.proposed_changes_json || recommendation?.proposed_changes, []);
  const parsedEvidence = safeJsonParse(recommendation?.evidence_json || recommendation?.supporting_facts, []);
  const parsedCitations = safeJsonParse(recommendation?.citations_json || recommendation?.policy_citations, []);

  res.json({
    exception: { ...exc, facts: safeJsonParse(exc.facts_json || exc.facts, {}) },
    investigation: investigation ? {
      ...investigation,
      confirmedFacts: parsedConfirmedFacts,
      confirmed_facts: parsedConfirmedFacts,
      missingInfo: parsedMissingInfo,
      missing_info: parsedMissingInfo,
      missing_information: parsedMissingInfo,
      conflicts: parsedConflicts,
    } : null,
    recommendation: recommendation ? {
      ...recommendation,
      proposedChanges: parsedProposedChanges,
      proposed_changes: parsedProposedChanges,
      evidence: parsedEvidence,
      citations: parsedCitations,
      policy_citations: parsedCitations,
    } : null,
    approval,
    auditLogs: auditLogs.map((l) => ({
      ...l,
      before: safeJsonParse(l.before_json || l.before_data, null),
      after:  safeJsonParse(l.after_json  || l.after_data, null),
    })),
  });
});

// POST /api/v1/exceptions/:id/investigate  — trigger AI workflow
router.post('/:id/investigate', requireRole('MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const tenantId = req.user!.tenantId;

  const exc = queryOne<any>('SELECT * FROM exception_cases WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }

  if (['RESOLVED', 'CANCELLED'].includes(exc.status)) {
    res.status(409).json({ error: `Cannot investigate an exception with status: ${exc.status}` });
    return;
  }

  try {
    const pipelineResult = await runInvestigationPipeline({
      exceptionId: id,
      tenantId,
      correlationId: `manual-${Date.now()}`,
      requestedByUserId: req.user!.id,
    });

    res.json({
      message: 'Investigation workflow completed and approval created',
      exceptionId: id,
      ...pipelineResult,
    });
  } catch (err: any) {
    console.error(`[exceptions/:id/investigate] Error:`, err);
    res.status(500).json({ error: 'Failed to trigger investigation', message: err.message });
  }
});

// POST /api/v1/exceptions/:id/cancel
router.post('/:id/cancel', requireRole('HR_ADMIN', 'SYSTEM_ADMIN'), (req: Request, res: Response): void => {
  const { id } = req.params as { id: string };
  const tenantId = req.user!.tenantId;

  const exc = queryOne<any>('SELECT * FROM exception_cases WHERE id = ? AND tenant_id = ?', [id, tenantId]);
  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }

  if (exc.status === 'RESOLVED' || exc.status === 'CANCELLED') {
    res.status(409).json({ error: `Exception is already ${exc.status}` });
    return;
  }

  execute(
    "UPDATE exception_cases SET status = 'CANCELLED', resolved_at = datetime('now'), version = version + 1 WHERE id = ?",
    [id]
  );

  execute(
    `INSERT INTO audit_logs (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, before_json, after_json, reason, created_at)
     VALUES (?, ?, 'USER', ?, 'EXCEPTION_CANCELLED', 'ExceptionCase', ?, ?, ?, ?, datetime('now'))`,
    [
      `audit-${Date.now()}`, tenantId, req.user!.id,
      id,
      JSON.stringify({ status: exc.status }),
      JSON.stringify({ status: 'CANCELLED' }),
      req.body.reason || 'Manually cancelled',
    ]
  );

  res.json({ message: 'Exception cancelled', exceptionId: id });
});

export default router;
