import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAll, queryOne, execute, transaction } from '../db/index.js';
import { publishEvent } from '../events/publisher.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/approvals  — pending approval inbox
router.get('/', (req: Request, res: Response): void => {
  const tenantId = req.user!.tenantId;
  const { status = 'PENDING' } = req.query;

  let sql = `
    SELECT a.*,
           ec.exception_type, ec.severity,
           COALESCE(ec.facts_json, ec.facts, '{}') AS facts_json,
           ec.employee_id,
           e.first_name || ' ' || e.last_name AS employeeName,
           e.department, e.employee_code AS employeeCode,
           r.proposed_action, r.rationale,
           COALESCE(r.proposed_changes_json, r.proposed_changes, '[]') AS proposed_changes_json,
           COALESCE(r.citations_json, r.policy_citations, '[]') AS citations_json,
           r.risk_level
    FROM approvals a
    JOIN exception_cases ec ON a.exception_id = ec.id
    LEFT JOIN recommendations r ON a.recommendation_id = r.id
    JOIN employees e ON ec.employee_id = e.id
    WHERE a.tenant_id = ?
  `;
  const params: any[] = [tenantId];

  if (status && status !== 'ALL') {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  if (req.user!.role === 'MANAGER') {
    sql += ' AND (a.assigned_approver_id = ? OR a.required_role = ? OR a.required_role IS NULL OR a.assigned_approver_id IS NULL)';
    params.push(req.user!.id, 'MANAGER');
  } else if (req.user!.role === 'EMPLOYEE') {
    sql += ' AND ec.employee_id = (SELECT id FROM employees WHERE user_id = ?)';
    params.push(req.user!.id);
  }

  sql += ' ORDER BY a.requested_at DESC';

  const safeParse = (val: any, fallback: any = []) => {
    if (!val) return fallback;
    if (typeof val !== 'string') return val;
    try {
      const p = JSON.parse(val);
      return p !== null && p !== undefined ? p : fallback;
    } catch {
      return fallback;
    }
  };

  const rows = queryAll<any>(sql, params);
  res.json({
    approvals: rows.map((r) => {
      const parsedChanges = safeParse(r.proposed_changes_json || r.proposed_changes, []);
      const parsedCitations = safeParse(r.citations_json || r.policy_citations, []);
      return {
        ...r,
        facts: safeParse(r.facts_json || r.facts, {}),
        proposedChanges: parsedChanges,
        proposed_changes: parsedChanges,
        citations: parsedCitations,
        policy_citations: parsedCitations,
      };
    }),
  });
});

const DecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_MORE_INFO']),
  decisionComment: z.string().min(1).optional(),
});

// POST /api/v1/approvals/:id/decision
router.post('/:id/decision', requireRole('MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const result = DecisionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    return;
  }

  const { decision, decisionComment } = result.data;
  const tenantId = req.user!.tenantId;
  const approvalId = req.params.id;

  const approval = queryOne<any>('SELECT * FROM approvals WHERE id = ? AND tenant_id = ?', [approvalId, tenantId]);
  if (!approval) {
    res.status(404).json({ error: 'Approval not found' });
    return;
  }

  if (approval.status !== 'PENDING') {
    res.status(409).json({ error: `Approval is already ${approval.status}` });
    return;
  }

  // Role check
  if (req.user!.role === 'MANAGER' && approval.required_role === 'HR_ADMIN') {
    res.status(403).json({ error: 'This approval requires HR_ADMIN role' });
    return;
  }

  // Expire check
  if (new Date(approval.expires_at) < new Date()) {
    execute("UPDATE approvals SET status = 'EXPIRED' WHERE id = ?", [approvalId]);
    res.status(409).json({ error: 'Approval has expired' });
    return;
  }

  if (decision === 'REJECT' && !decisionComment) {
    res.status(400).json({ error: 'A comment is required when rejecting' });
    return;
  }

  try {
    // If APPROVE — apply the correction in a transaction
    if (decision === 'APPROVE') {
      const rec = queryOne<any>('SELECT * FROM recommendations WHERE id = ?', [approval.recommendation_id]);
      const exc = queryOne<any>('SELECT * FROM exception_cases WHERE id = ?', [approval.exception_id]);

      if (!rec || !exc) {
        res.status(404).json({ error: 'Related recommendation or exception not found' });
        return;
      }

      const proposedChanges: any[] = JSON.parse(rec.proposed_changes_json || '[]');

      transaction(() => {
        // Apply attendance correction if there are proposed changes
        if (proposedChanges.length > 0 && exc.attendance_record_id) {
          const ar = queryOne<any>('SELECT * FROM attendance_records WHERE id = ?', [exc.attendance_record_id]);
          if (ar) {
            const beforeData = { clockInUtc: ar.clock_in_utc, clockOutUtc: ar.clock_out_utc, version: ar.version };
            const updates: any = {};
            for (const change of proposedChanges) {
              if (change.field === 'clock_out_utc') updates.clockOutUtc = change.proposedValue;
              if (change.field === 'clock_in_utc')  updates.clockInUtc  = change.proposedValue;
            }

            if (updates.clockOutUtc !== undefined || updates.clockInUtc !== undefined) {
              execute(
                `UPDATE attendance_records
                 SET clock_out_utc = COALESCE(?, clock_out_utc),
                     clock_in_utc  = COALESCE(?, clock_in_utc),
                     source = 'SYSTEM_ADJUSTMENT',
                     status = 'RESOLVED',
                     version = version + 1,
                     updated_at = datetime('now')
                 WHERE id = ? AND version = ?`,
                [updates.clockOutUtc ?? null, updates.clockInUtc ?? null, exc.attendance_record_id, ar.version]
              );

              const afterAr = queryOne<any>('SELECT * FROM attendance_records WHERE id = ?', [exc.attendance_record_id]);
              execute(
                `INSERT INTO audit_logs (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, before_data, before_json, after_data, after_json, reason, correlation_id, created_at)
                 VALUES (?, ?, 'USER', ?, 'ATTENDANCE_CORRECTED', 'AttendanceRecord', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                  `audit-${Date.now()}-${Math.random().toString(36).substring(2,6)}`,
                  tenantId, req.user!.id,
                  exc.attendance_record_id,
                  JSON.stringify(beforeData), JSON.stringify(beforeData),
                  JSON.stringify({ clockInUtc: afterAr?.clock_in_utc, clockOutUtc: afterAr?.clock_out_utc }),
                  JSON.stringify({ clockInUtc: afterAr?.clock_in_utc, clockOutUtc: afterAr?.clock_out_utc }),
                  decisionComment || 'Manager approved correction',
                  approvalId,
                ]
              );
            }
          }
        }

        // Update approval status
        execute(
          `UPDATE approvals SET status = 'APPROVED', decision = 'APPROVE', decision_comment = ?, decided_at = datetime('now'), consumed_at = datetime('now') WHERE id = ?`,
          [decisionComment || null, approvalId]
        );

        // Resolve exception
        execute(
          `UPDATE exception_cases SET status = 'RESOLVED', resolved_at = datetime('now'), version = version + 1 WHERE id = ?`,
          [approval.exception_id]
        );

        // Update recommendation status
        execute("UPDATE recommendations SET status = 'ACCEPTED' WHERE id = ?", [approval.recommendation_id]);

        // Audit the approval decision
        const beforeStatusJson = JSON.stringify({ status: 'PENDING' });
        const afterStatusJson = JSON.stringify({ status: 'APPROVED', decision });
        execute(
          `INSERT INTO audit_logs (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, before_data, before_json, after_data, after_json, reason, correlation_id, created_at)
           VALUES (?, ?, 'USER', ?, 'APPROVAL_DECISION', 'Approval', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            `audit-${Date.now()}-${Math.random().toString(36).substring(2,6)}`,
            tenantId, req.user!.id, approvalId,
            beforeStatusJson, beforeStatusJson,
            afterStatusJson, afterStatusJson,
            decisionComment || null,
            approvalId,
          ]
        );
      });
    } else {
      // REJECT or REQUEST_MORE_INFO
      const newStatus = decision === 'REJECT' ? 'REJECTED' : 'PENDING';
      execute(
        `UPDATE approvals SET decision = ?, decision_comment = ?, decided_at = datetime('now'), status = ? WHERE id = ?`,
        [decision, decisionComment || null, decision === 'REJECT' ? 'REJECTED' : 'PENDING', approvalId]
      );

      execute(
        `UPDATE exception_cases SET status = ? WHERE id = ?`,
        [decision === 'REJECT' ? 'REJECTED' : 'NEEDS_MORE_INFO', approval.exception_id]
      );

      const beforeStatusJson = JSON.stringify({ status: 'PENDING' });
      const afterStatusJson = JSON.stringify({ status: decision });
      execute(
        `INSERT INTO audit_logs (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id, before_data, before_json, after_data, after_json, reason, correlation_id, created_at)
         VALUES (?, ?, 'USER', ?, 'APPROVAL_DECISION', 'Approval', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).substring(2,6)}`,
          tenantId, req.user!.id, approvalId,
          beforeStatusJson, beforeStatusJson,
          afterStatusJson, afterStatusJson,
          decisionComment || null, approvalId,
        ]
      );
    }

    // Notify Inngest
    await publishEvent('attendance/approval.decision-submitted', {
      tenantId,
      correlationId: approvalId,
      approvalId,
      exceptionId: approval.exception_id,
      decision,
      decisionComment,
      decidedByUserId: req.user!.id,
      decidedAt: new Date().toISOString(),
    });

    res.json({ message: `Decision recorded: ${decision}`, approvalId });
  } catch (err: any) {
    console.error('[approvals] Error recording decision:', err);
    res.status(500).json({ error: 'Failed to record decision', message: err.message });
  }
});

export default router;
