import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAll, queryOne, execute, transaction } from '../db/index.js';

const router = Router();
router.use(requireAuth);

function parseLocalTimeToUtc(localDate: string, timeStr: string): string {
  // Assume America/New_York standard work timezone (UTC-5 in winter, UTC-4 in summer)
  // Or parse dynamically using Date string
  const [hours, minutes] = timeStr.split(':').map(Number);
  // Default to 5 hours offset for America/New_York winter
  const d = new Date(`${localDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`);
  // Shift by 5 hours to represent UTC equivalent for EST
  d.setUTCHours(d.getUTCHours() + 5);
  return d.toISOString();
}

function formatLocalTime(isoStr: string): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
}

// GET /api/v1/shifts/my-shift — Retrieve current assigned shift timings for logged-in user
router.get('/my-shift', (req: Request, res: Response): void => {
  const tenantId = req.user!.tenantId;
  const today = new Date().toISOString().slice(0, 10);

  let employee = queryOne<any>('SELECT * FROM employees WHERE user_id = ?', [req.user!.id]);
  if (!employee) {
    employee = queryOne<any>('SELECT * FROM employees WHERE tenant_id = ? LIMIT 1', [tenantId]);
  }

  if (!employee) {
    res.status(404).json({ error: 'No employee record found' });
    return;
  }

  let shift = queryOne<any>(
    'SELECT * FROM shifts WHERE employee_id = ? AND local_date = ? LIMIT 1',
    [employee.id, today]
  );

  // If no shift assigned for today, assign standard morning shift
  if (!shift) {
    const shiftId = `shift-${employee.id}-${today}`;
    const startUtc = `${today}T14:00:00.000Z`;
    const endUtc = `${today}T22:00:00.000Z`;
    execute(
      `INSERT OR IGNORE INTO shifts
         (id, tenant_id, employee_id, local_date, timezone, scheduled_start_utc, scheduled_end_utc, break_minutes, shift_type, status, version, created_at)
       VALUES (?, ?, ?, ?, 'America/New_York', ?, ?, 30, 'REGULAR', 'SCHEDULED', 1, datetime('now'))`,
      [shiftId, tenantId, employee.id, today, startUtc, endUtc]
    );
    shift = queryOne<any>('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  }

  // Get manager info
  let manager: any = null;
  if (employee.manager_employee_id) {
    manager = queryOne<any>(
      "SELECT id, first_name || ' ' || last_name AS name, email, department, job_title FROM employees WHERE id = ?",
      [employee.manager_employee_id]
    );
  }

  res.json({
    shift: {
      ...shift,
      startTimeLocal: formatLocalTime(shift.scheduled_start_utc),
      endTimeLocal: formatLocalTime(shift.scheduled_end_utc),
    },
    employee: {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      code: employee.employee_code,
      department: employee.department,
      jobTitle: employee.job_title,
    },
    manager: manager || { name: 'Operations Manager', email: 'mgr.ops@acme.com', department: employee.department },
    rules: {
      gracePeriodMinutes: 10,
      earlyDepartureMinutes: 15,
      maxDurationMultiplier: 1.5,
      description: 'Lateness flagged after 10m grace period. Missing clock-out flagged if elapsed exceeds 1.5x shift duration or upon consecutive clock-in.',
    },
  });
});

// GET /api/v1/shifts — List shifts
router.get('/', (req: Request, res: Response): void => {
  const tenantId = req.user!.tenantId;
  const { employeeId, startDate, endDate } = req.query;

  let sql = `
    SELECT s.*,
           e.first_name || ' ' || e.last_name AS employeeName,
           e.employee_code AS employeeCode,
           e.department,
           m.first_name || ' ' || m.last_name AS managerName
    FROM shifts s
    JOIN employees e ON s.employee_id = e.id
    LEFT JOIN employees m ON e.manager_employee_id = m.id
    WHERE s.tenant_id = ?
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

  if (employeeId) {
    sql += ' AND s.employee_id = ?';
    params.push(employeeId);
  }
  if (startDate) {
    sql += ' AND s.local_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND s.local_date <= ?';
    params.push(endDate);
  }

  sql += ' ORDER BY s.local_date DESC, s.scheduled_start_utc ASC LIMIT 200';

  const rows = queryAll<any>(sql, params);
  res.json({
    shifts: rows.map((r) => ({
      ...r,
      startTimeLocal: formatLocalTime(r.scheduled_start_utc),
      endTimeLocal: formatLocalTime(r.scheduled_end_utc),
    })),
    total: rows.length,
  });
});

const AssignShiftSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM (e.g. 09:00)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM (e.g. 17:00)'),
  breakMinutes: z.number().int().min(0).max(180).default(30),
  shiftType: z.enum(['REGULAR', 'OVERNIGHT', 'ON_CALL']).default('REGULAR'),
});

// POST /api/v1/shifts/assign — Manager/Admin assigns shift timings to an employee
router.post('/assign', requireRole('MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'), (req: Request, res: Response): void => {
  const parsed = AssignShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    return;
  }

  const { employeeId, startDate, endDate = startDate, startTime, endTime, breakMinutes, shiftType } = parsed.data;
  const tenantId = req.user!.tenantId;

  const employee = queryOne<any>('SELECT * FROM employees WHERE id = ? AND tenant_id = ?', [employeeId, tenantId]);
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  // Iterate from startDate to endDate
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const assignedDates: string[] = [];

  transaction(() => {
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      assignedDates.push(dateStr);

      const startUtc = parseLocalTimeToUtc(dateStr, startTime);
      let endUtc = parseLocalTimeToUtc(dateStr, endTime);

      // Handle overnight shift if endTime < startTime
      if (endTime <= startTime) {
        const nextDay = new Date(cur);
        nextDay.setDate(nextDay.getDate() + 1);
        endUtc = parseLocalTimeToUtc(nextDay.toISOString().slice(0, 10), endTime);
      }

      const shiftId = `shift-${employeeId}-${dateStr}`;

      execute(
        `INSERT OR REPLACE INTO shifts
           (id, tenant_id, employee_id, local_date, timezone, scheduled_start_utc, scheduled_end_utc, break_minutes, shift_type, status, version, created_at)
         VALUES (?, ?, ?, ?, 'America/New_York', ?, ?, ?, ?, 'SCHEDULED', 1, datetime('now'))`,
        [shiftId, tenantId, employeeId, dateStr, startUtc, endUtc, breakMinutes, shiftType]
      );

      cur.setDate(cur.getDate() + 1);
    }

    // In-app notification for the employee
    if (employee.user_id) {
      const notifId = `notif-shift-${Date.now().toString(36)}`;
      const managerName = req.user!.displayName || 'Your Manager';
      execute(
        `INSERT INTO notifications
           (id, tenant_id, recipient_user_id, type, title, body, related_entity_type, related_entity_id, idempotency_key, status, created_at)
         VALUES (?, ?, ?, 'SHIFT_ASSIGNED', 'Shift Timings Assigned', ?, 'Shift', ?, ?, 'UNREAD', datetime('now'))`,
        [
          notifId,
          tenantId,
          employee.user_id,
          `${managerName} assigned your shift timing: ${startTime} to ${endTime} (${assignedDates.length} day${assignedDates.length > 1 ? 's' : ''}). Punches will be measured against this schedule.`,
          `shift-${employeeId}-${startDate}`,
          `idem-${notifId}`,
        ]
      );
    }
  });

  res.status(201).json({
    success: true,
    message: `Assigned shift timings (${startTime} – ${endTime}) to ${employee.first_name} ${employee.last_name} for ${assignedDates.length} day(s).`,
    assignedDates,
    employeeName: `${employee.first_name} ${employee.last_name}`,
    timings: { startTime, endTime, breakMinutes },
  });
});

export default router;
