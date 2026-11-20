import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAll, queryOne, execute } from '../db/index.js';
import { detectExceptions } from '../domain/exceptionDetector.js';
import { runInvestigationPipeline } from '../domain/investigationRunner.js';
import { publishEvent } from '../events/publisher.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/attendance
router.get('/', (req: Request, res: Response): void => {
  const { employeeId, startDate, endDate, status } = req.query;
  const tenantId = req.user!.tenantId;

  let sql = `
    SELECT a.*, 
           e.first_name || ' ' || e.last_name AS employeeName,
           e.employee_code AS employeeCode,
           e.department,
           s.scheduled_start_utc, s.scheduled_end_utc, s.shift_type
    FROM attendance_records a
    JOIN employees e ON a.employee_id = e.id
    LEFT JOIN shifts s ON a.shift_id = s.id
    WHERE a.tenant_id = ?
  `;
  const params: any[] = [tenantId];

  if (req.user!.role === 'EMPLOYEE') {
    sql += ' AND e.user_id = ?';
    params.push(req.user!.id);
  } else if (req.user!.role === 'MANAGER') {
    const mgr = queryOne<any>('SELECT id FROM employees WHERE user_id = ?', [req.user!.id]);
    if (mgr) {
      sql += ' AND (e.manager_employee_id = ? OR e.user_id = ?)';
      params.push(mgr.id, req.user!.id);
    }
  }

  if (employeeId) { sql += ' AND a.employee_id = ?'; params.push(employeeId); }
  if (status)     { sql += ' AND a.status = ?';      params.push(status); }
  if (startDate)  { sql += ' AND a.created_at >= ?'; params.push(startDate); }
  if (endDate)    { sql += ' AND a.created_at <= ?'; params.push(`${endDate}T23:59:59`); }

  sql += ' ORDER BY a.created_at DESC LIMIT 200';

  const records = queryAll<any>(sql, params);
  res.json({ records, total: records.length });
});

const ScanSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departmentId: z.string().optional(),
});

// POST /api/v1/attendance/scan  — trigger exception detection
router.post('/scan', requireRole('MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const result = ScanSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    return;
  }

  const { startDate, endDate, departmentId } = result.data;
  const tenantId = req.user!.tenantId;

  try {
    const exceptions = await detectExceptions({ tenantId, startDate, endDate, departmentId });

    // Identify exceptions needing active approval generation
    const pendingNeedsApproval = exceptions.filter((exc) => {
      const existingAppr = queryOne<any>(
        "SELECT id FROM approvals WHERE exception_id = ? AND status = 'PENDING' LIMIT 1",
        [exc.id]
      );
      return !existingAppr;
    });

    // Run AI pipeline in parallel for uninvestigated exceptions
    if (pendingNeedsApproval.length > 0) {
      await Promise.allSettled(
        pendingNeedsApproval.map(async (exc) => {
          await publishEvent('attendance/exception.detected', {
            tenantId,
            correlationId: `scan-${Date.now()}`,
            exceptionId: exc.id,
            dedupeKey: exc.dedupeKey,
            employeeId: exc.employeeId,
            shiftId: exc.shiftId ?? '',
            exceptionType: exc.exceptionType,
            severity: exc.severity,
            facts: exc.facts,
            timestamp: new Date().toISOString(),
          }).catch(() => {});

          return runInvestigationPipeline({
            exceptionId: exc.id,
            tenantId,
            correlationId: `scan-${Date.now()}`,
            requestedByUserId: req.user!.id,
          });
        })
      );
    }

    res.json({
      message: `Scan complete. ${exceptions.length} exception(s) detected (${pendingNeedsApproval.length} new approvals generated).`,
      exceptions: exceptions.length,
      newApprovals: pendingNeedsApproval.length,
      details: exceptions.map((e) => ({ id: e.id, type: e.exceptionType, severity: e.severity, employeeId: e.employeeId })),
    });
  } catch (err: any) {
    console.error('[scan] Error:', err);
    res.status(500).json({ error: 'Scan failed', message: err.message });
  }
});

const PunchSchema = z.object({
  action: z.enum(['IN', 'OUT']),
  notes: z.string().optional(),
  employeeId: z.string().optional(),
});

// GET /api/v1/attendance/punch-status
router.get('/punch-status', (req: Request, res: Response): void => {
  const tenantId = req.user!.tenantId;
  let employee = queryOne<any>('SELECT * FROM employees WHERE user_id = ?', [req.user!.id]);
  
  if (!employee) {
    employee = queryOne<any>('SELECT * FROM employees WHERE tenant_id = ? LIMIT 1', [tenantId]);
  }

  if (!employee) {
    res.json({ isClockedIn: false, currentRecord: null, lastClockIn: null });
    return;
  }

  const activeRecord = queryOne<any>(
    "SELECT * FROM attendance_records WHERE employee_id = ? AND clock_out_utc IS NULL ORDER BY created_at DESC LIMIT 1",
    [employee.id]
  );

  const lastRecord = queryOne<any>(
    "SELECT * FROM attendance_records WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1",
    [employee.id]
  );

  res.json({
    employeeId: employee.id,
    employeeName: `${employee.first_name} ${employee.last_name}`,
    isClockedIn: !!activeRecord,
    currentRecord: activeRecord || null,
    lastRecord: lastRecord || null,
  });
});

// POST /api/v1/attendance/punch — Clock in or clock out
router.post('/punch', (req: Request, res: Response): void => {
  const parsed = PunchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid punch data', details: parsed.error.issues });
    return;
  }

  const { action, notes, employeeId: targetEmpId } = parsed.data;
  const tenantId = req.user!.tenantId;

  let employee = queryOne<any>('SELECT * FROM employees WHERE user_id = ?', [req.user!.id]);
  if (!employee && targetEmpId) {
    employee = queryOne<any>('SELECT * FROM employees WHERE id = ?', [targetEmpId]);
  }
  if (!employee) {
    employee = queryOne<any>('SELECT * FROM employees WHERE tenant_id = ? LIMIT 1', [tenantId]);
  }

  if (!employee) {
    res.status(404).json({ error: 'Employee record not found for user' });
    return;
  }

  const nowIso = new Date().toISOString();
  const dateStr = nowIso.slice(0, 10);

  if (action === 'IN') {
    const active = queryOne<any>(
      "SELECT * FROM attendance_records WHERE employee_id = ? AND clock_out_utc IS NULL ORDER BY created_at DESC LIMIT 1",
      [employee.id]
    );

    let consecutiveNotice = '';
    if (active) {
      // User rule: Consecutive clock-in means the previous shift had NO CLOCK OUT!
      // Do not block the employee! Flag the previous unclosed record as MISSING_CLOCK_OUT.
      execute(
        `UPDATE attendance_records
         SET status = 'FLAGGED', version = version + 1, updated_at = datetime('now')
         WHERE id = ?`,
        [active.id]
      );

      const prevShift = active.shift_id
        ? queryOne<any>('SELECT * FROM shifts WHERE id = ?', [active.shift_id])
        : queryOne<any>('SELECT * FROM shifts WHERE employee_id = ? AND local_date = ? LIMIT 1', [employee.id, active.created_at.slice(0, 10)]);

      if (prevShift) {
        const prevExcId = `exc-${uuidv4().substring(0, 8)}`;
        const dedupeKey = `${tenantId}|${employee.id}|${prevShift.id}|MISSING_CLOCK_OUT`;
        const facts = {
          scheduledStart: prevShift.scheduled_start_utc,
          scheduledEnd: prevShift.scheduled_end_utc,
          actualClockIn: active.clock_in_utc,
          clockOut: null,
          reason: 'Consecutive clock-in detected with no clock-out recorded for previous shift.',
          isConsecutiveClockIn: true,
        };
        const factsStr = JSON.stringify(facts);

        execute(
          `INSERT OR REPLACE INTO exception_cases
             (id, tenant_id, employee_id, shift_id, attendance_record_id, exception_type, severity, status, dedupe_key, facts, facts_json, version, detected_at, assigned_manager_id)
           VALUES (?, ?, ?, ?, ?, 'MISSING_CLOCK_OUT', 'HIGH', 'DETECTED', ?, ?, ?, 1, datetime('now'), ?)`,
          [
            prevExcId, tenantId, employee.id, prevShift.id, active.id,
            dedupeKey, factsStr, factsStr, employee.manager_employee_id || null,
          ]
        );

        setTimeout(() => {
          runInvestigationPipeline({
            exceptionId: prevExcId,
            tenantId,
            correlationId: `consecutive-in-${Date.now()}`,
            requestedByUserId: req.user!.id,
          }).catch(() => {});
        }, 100);
      }
      consecutiveNotice = ' (Previous unclosed shift flagged as Missing Clock-Out)';
    }

    let shift = queryOne<any>(
      "SELECT * FROM shifts WHERE employee_id = ? AND local_date = ? LIMIT 1",
      [employee.id, dateStr]
    );

    if (!shift) {
      const shiftId = `shift-${employee.id}-${dateStr}`;
      const startUtc = `${dateStr}T14:00:00.000Z`;
      const endUtc = `${dateStr}T22:00:00.000Z`;
      execute(
        `INSERT OR IGNORE INTO shifts
           (id, tenant_id, employee_id, local_date, timezone, scheduled_start_utc, scheduled_end_utc, break_minutes, shift_type, status, version, created_at)
         VALUES (?, ?, ?, ?, 'America/New_York', ?, ?, 30, 'REGULAR', 'SCHEDULED', 1, datetime('now'))`,
        [shiftId, tenantId, employee.id, dateStr, startUtc, endUtc]
      );
      shift = { id: shiftId, scheduled_start_utc: startUtc, scheduled_end_utc: endUtc };
    }

    // Measure against assigned shift timing: 10m grace period
    const shiftStart = new Date(shift.scheduled_start_utc);
    const nowTime = new Date(nowIso);
    const latenessMins = Math.round((nowTime.getTime() - shiftStart.getTime()) / 60000);
    const isLate = latenessMins > 10;
    const initialStatus = isLate ? 'FLAGGED' : 'RECORDED';

    const recordId = `att-${employee.id}-${Date.now().toString(36)}`;
    execute(
      `INSERT INTO attendance_records
         (id, tenant_id, employee_id, shift_id, clock_in_utc, clock_out_utc, source, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, null, 'WEB_CLOCK', ?, 1, datetime('now'), datetime('now'))`,
      [recordId, tenantId, employee.id, shift ? shift.id : null, nowIso, initialStatus]
    );

    const notifId = `notif-punch-${Date.now().toString(36)}`;
    execute(
      `INSERT OR IGNORE INTO notifications
         (id, tenant_id, recipient_user_id, type, title, body, related_entity_type, related_entity_id, idempotency_key, status, created_at)
       VALUES (?, ?, ?, 'ATTENDANCE_PUNCH', 'Clock-In Confirmed', ?, 'AttendanceRecord', ?, ?, 'UNREAD', datetime('now'))`,
      [
        notifId,
        tenantId,
        req.user!.id,
        isLate
          ? `Clock-In recorded at ${new Date().toLocaleTimeString()} (${latenessMins} mins late vs assigned shift start). Exception submitted for AI review.${consecutiveNotice}`
          : `You successfully clocked in on time at ${new Date().toLocaleTimeString()} (Web Punch).${consecutiveNotice}`,
        recordId,
        `idem-${notifId}`,
      ]
    );

    res.json({
      success: true,
      action: 'IN',
      message: `Clock-In recorded at ${new Date().toLocaleTimeString()}${isLate ? ` (${latenessMins}m late vs scheduled shift)` : ''}${consecutiveNotice}`,
      recordId,
      clockInUtc: nowIso,
      isLate,
      latenessMins: isLate ? latenessMins : 0,
      shift: {
        scheduledStart: shift.scheduled_start_utc,
        scheduledEnd: shift.scheduled_end_utc,
      },
    });

    // Trigger AI pipeline in background if anomaly detected
    setTimeout(async () => {
      try {
        const detected = await detectExceptions({ tenantId, startDate: dateStr, endDate: dateStr });
        const matched = detected.filter((e) => e.employeeId === employee.id);
        for (const exc of matched) {
          await runInvestigationPipeline({
            exceptionId: exc.id,
            tenantId,
            correlationId: `punch-in-${Date.now()}`,
            requestedByUserId: req.user!.id,
          }).catch(() => {});
        }
      } catch (err) {
        // silent
      }
    }, 150);
  } else {
    // PUNCH OUT
    const active = queryOne<any>(
      "SELECT * FROM attendance_records WHERE employee_id = ? AND clock_out_utc IS NULL ORDER BY created_at DESC LIMIT 1",
      [employee.id]
    );

    let recordId: string;
    if (active) {
      recordId = active.id;
      execute(
        `UPDATE attendance_records
         SET clock_out_utc = ?, status = 'RECORDED', version = version + 1, updated_at = datetime('now')
         WHERE id = ?`,
        [nowIso, active.id]
      );
    } else {
      recordId = `att-${employee.id}-${Date.now().toString(36)}`;
      execute(
        `INSERT INTO attendance_records
           (id, tenant_id, employee_id, shift_id, clock_in_utc, clock_out_utc, source, status, version, created_at, updated_at)
         VALUES (?, ?, ?, null, null, ?, 'WEB_CLOCK', 'FLAGGED', 1, datetime('now'), datetime('now'))`,
        [recordId, tenantId, employee.id, nowIso]
      );
    }

    const notifId = `notif-punch-${Date.now().toString(36)}`;
    execute(
      `INSERT OR IGNORE INTO notifications
         (id, tenant_id, recipient_user_id, type, title, body, related_entity_type, related_entity_id, idempotency_key, status, created_at)
       VALUES (?, ?, ?, 'ATTENDANCE_PUNCH', 'Clock-Out Confirmed', ?, 'AttendanceRecord', ?, ?, 'UNREAD', datetime('now'))`,
      [
        notifId,
        tenantId,
        req.user!.id,
        `You successfully clocked out at ${new Date().toLocaleTimeString()} (Web Punch).`,
        recordId,
        `idem-${notifId}`,
      ]
    );

    res.json({
      success: true,
      action: 'OUT',
      message: `Clock-Out successfully recorded at ${new Date().toLocaleTimeString()}`,
      recordId,
      clockOutUtc: nowIso,
    });

    // Run real-time exception detection & AI pipeline in background
    setTimeout(async () => {
      try {
        const detected = await detectExceptions({ tenantId, startDate: dateStr, endDate: dateStr });
        const matched = detected.filter((e) => e.employeeId === employee.id);
        for (const exc of matched) {
          await runInvestigationPipeline({
            exceptionId: exc.id,
            tenantId,
            correlationId: `punch-out-${Date.now()}`,
            requestedByUserId: req.user!.id,
          }).catch(() => {});
        }
      } catch (err) {
        // silent
      }
    }, 150);
  }
});

export default router;
