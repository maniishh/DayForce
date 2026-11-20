import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/index.js';

// Configurable thresholds
const CONFIG = {
  lateArrivalGraceMinutes:   10,
  earlyDepartureMins:        15,
  overtimeDailyHours:         8,
  missingClockOutWindowMins: 60, // only flag after shift end + 60 min
  maxShiftDurationMultiplier: 1.5, // 1.5x scheduled shift duration anomaly threshold
};

interface DetectedExc {
  id: string;
  dedupeKey: string;
  tenantId: string;
  employeeId: string;
  shiftId?: string;
  attendanceRecordId?: string;
  exceptionType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  facts: Record<string, any>;
  status: string;
  assignedManagerId?: string;
}

export async function detectExceptions(opts: {
  tenantId: string;
  startDate: string;
  endDate: string;
  departmentId?: string;
}): Promise<DetectedExc[]> {
  const { tenantId, startDate, endDate } = opts;

  const shifts = queryAll<any>(
    `SELECT s.*, 
            e.id AS empId, e.first_name || ' ' || e.last_name AS empName,
            e.department, e.manager_employee_id,
            ar.id AS arId, ar.clock_in_utc, ar.clock_out_utc, ar.version AS arVersion
     FROM shifts s
     JOIN employees e ON s.employee_id = e.id
     LEFT JOIN attendance_records ar ON ar.shift_id = s.id
     WHERE s.tenant_id = ? AND s.local_date BETWEEN ? AND ?
       AND s.status != 'CANCELLED'
     ORDER BY s.scheduled_start_utc ASC`,
    [tenantId, startDate, endDate]
  );

  const detected: DetectedExc[] = [];
  const now = new Date();

  for (const shift of shifts) {
    const startUtc  = new Date(shift.scheduled_start_utc);
    const endUtc    = new Date(shift.scheduled_end_utc);
    const clockIn   = shift.clock_in_utc  ? new Date(shift.clock_in_utc)  : null;
    const clockOut  = shift.clock_out_utc ? new Date(shift.clock_out_utc) : null;

    // Determine manager (references employees.id)
    const assignedManagerId = shift.manager_employee_id ?? null;

    // ── MISSING_CLOCK_IN ───────────────────────────────────────────────────
    if (!clockIn && now > new Date(startUtc.getTime() + CONFIG.lateArrivalGraceMinutes * 60000)) {
      // Check approved leave
      const leave = queryOne<any>(
        `SELECT id FROM leave_records 
         WHERE employee_id = ? AND status = 'APPROVED'
           AND start_utc <= ? AND end_utc >= ?`,
        [shift.empId, shift.scheduled_end_utc, shift.scheduled_start_utc]
      );
      if (!leave) {
        const exc = buildExc(tenantId, shift.empId, shift, 'MISSING_CLOCK_IN', 'HIGH', {
          scheduledStart: shift.scheduled_start_utc,
          scheduledEnd:   shift.scheduled_end_utc,
          reason: 'No clock-in found after grace period elapsed',
        }, assignedManagerId);
        const saved = upsertException(exc);
        if (saved) detected.push(saved);
      }
    }

    // ── LATE_ARRIVAL ───────────────────────────────────────────────────────
    if (clockIn) {
      const latenessMs  = clockIn.getTime() - startUtc.getTime();
      const latenessMins = latenessMs / 60000;
      if (latenessMins > CONFIG.lateArrivalGraceMinutes) {
        const severity: 'LOW' | 'MEDIUM' | 'HIGH' =
          latenessMins > 60 ? 'HIGH' : latenessMins > 30 ? 'MEDIUM' : 'LOW';
        const exc = buildExc(tenantId, shift.empId, shift, 'LATE_ARRIVAL', severity, {
          scheduledStart:  shift.scheduled_start_utc,
          actualClockIn:   shift.clock_in_utc,
          latenessMins:    Math.round(latenessMins),
          gracePeriodMins: CONFIG.lateArrivalGraceMinutes,
        }, assignedManagerId);
        const saved = upsertException(exc);
        if (saved) detected.push(saved);
      }
    }

    // ── MISSING_CLOCK_OUT ─────────────────────────────────────────────────
    if (clockIn && !clockOut) {
      const shiftDurationMs = Math.max(1, endUtc.getTime() - startUtc.getTime());
      const elapsedSinceClockInMs = now.getTime() - clockIn.getTime();
      const threshold15xMs = shiftDurationMs * CONFIG.maxShiftDurationMultiplier;
      const windowEnd = new Date(endUtc.getTime() + CONFIG.missingClockOutWindowMins * 60000);

      // Flag if past shift processing window OR elapsed work duration exceeds 1.5x assigned shift duration
      const isExceeded15x = elapsedSinceClockInMs >= threshold15xMs;
      const isPastWindow = now > windowEnd;

      if (isExceeded15x || isPastWindow) {
        const elapsedHours = parseFloat((elapsedSinceClockInMs / (1000 * 60 * 60)).toFixed(2));
        const scheduledHours = parseFloat((shiftDurationMs / (1000 * 60 * 60)).toFixed(2));
        const exc = buildExc(tenantId, shift.empId, shift, 'MISSING_CLOCK_OUT', 'HIGH', {
          scheduledStart: shift.scheduled_start_utc,
          scheduledEnd: shift.scheduled_end_utc,
          scheduledDurationHours: scheduledHours,
          actualClockIn: shift.clock_in_utc,
          clockOut: null,
          elapsedHours,
          isExceeded15x,
          reason: isExceeded15x
            ? `Elapsed work duration (${elapsedHours}h) exceeded 1.5x assigned shift duration (${scheduledHours}h) with no departure punch recorded.`
            : 'No clock-out found after assigned shift end and processing window elapsed.',
        }, assignedManagerId);
        const saved = upsertException(exc);
        if (saved) detected.push(saved);
      }
    }

    // ── EARLY_DEPARTURE ────────────────────────────────────────────────────
    if (clockIn && clockOut) {
      const earlyMs   = endUtc.getTime() - clockOut.getTime();
      const earlyMins = earlyMs / 60000;
      if (earlyMins > CONFIG.earlyDepartureMins) {
        const severity: 'LOW' | 'MEDIUM' | 'HIGH' =
          earlyMins > 60 ? 'HIGH' : earlyMins > 30 ? 'MEDIUM' : 'LOW';
        const exc = buildExc(tenantId, shift.empId, shift, 'EARLY_DEPARTURE', severity, {
          scheduledEnd:    shift.scheduled_end_utc,
          actualClockOut:  shift.clock_out_utc,
          earlyMins:       Math.round(earlyMins),
          thresholdMins:   CONFIG.earlyDepartureMins,
        }, assignedManagerId);
        const saved = upsertException(exc);
        if (saved) detected.push(saved);
      }
    }

    // ── OVERTIME_REVIEW ────────────────────────────────────────────────────
    if (clockIn && clockOut) {
      const workedMs    = clockOut.getTime() - clockIn.getTime();
      const workedHours = workedMs / (1000 * 60 * 60) - shift.break_minutes / 60;
      if (workedHours > CONFIG.overtimeDailyHours) {
        const exc = buildExc(tenantId, shift.empId, shift, 'OVERTIME_REVIEW', 'MEDIUM', {
          scheduledStart:  shift.scheduled_start_utc,
          scheduledEnd:    shift.scheduled_end_utc,
          actualClockIn:   shift.clock_in_utc,
          actualClockOut:  shift.clock_out_utc,
          workedHours:     parseFloat(workedHours.toFixed(2)),
          thresholdHours:  CONFIG.overtimeDailyHours,
          breakMinutes:    shift.break_minutes,
        }, assignedManagerId);
        const saved = upsertException(exc);
        if (saved) detected.push(saved);
      }
    }
  }

  return detected;
}

function buildExc(
  tenantId: string,
  employeeId: string,
  shift: any,
  exceptionType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH',
  facts: Record<string, any>,
  assignedManagerId?: string | null
): DetectedExc {
  const dedupeKey = `${tenantId}|${employeeId}|${shift.id}|${exceptionType}`;
  return {
    id: `exc-${uuidv4().substring(0,8)}`,
    dedupeKey,
    tenantId,
    employeeId,
    shiftId: shift.id,
    attendanceRecordId: shift.arId ?? undefined,
    exceptionType,
    severity,
    facts,
    status: 'DETECTED',
    assignedManagerId: assignedManagerId ?? undefined,
  };
}

function upsertException(exc: DetectedExc): DetectedExc | null {
  const existing = queryOne<any>('SELECT id, status FROM exception_cases WHERE dedupe_key = ?', [exc.dedupeKey]);
  const factsStr = JSON.stringify(exc.facts);

  if (existing) {
    // Don't re-open resolved/cancelled ones
    if (['RESOLVED', 'CANCELLED'].includes(existing.status)) return null;
    execute(
      'UPDATE exception_cases SET facts = ?, facts_json = ?, severity = ? WHERE dedupe_key = ?',
      [factsStr, factsStr, exc.severity, exc.dedupeKey]
    );
    return { ...exc, id: existing.id };
  }

  execute(
    `INSERT INTO exception_cases
       (id, tenant_id, employee_id, shift_id, attendance_record_id,
        exception_type, severity, status, dedupe_key, facts, facts_json,
        version, detected_at, assigned_manager_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'DETECTED', ?, ?, ?, 1, datetime('now'), ?)`,
    [
      exc.id, exc.tenantId, exc.employeeId,
      exc.shiftId ?? null, exc.attendanceRecordId ?? null,
      exc.exceptionType, exc.severity, exc.dedupeKey,
      factsStr, factsStr, exc.assignedManagerId ?? null,
    ]
  );
  return exc;
}
