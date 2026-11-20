import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryAll, queryOne, execute } from '../db/index.js';
import { setupEmployeeAndShifts } from '../domain/employeeOnboarding.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/employees
router.get('/', (req: Request, res: Response): void => {
  const { department } = req.query;
  const tenantId = req.user!.tenantId;

  let sql = `
    SELECT e.*, u.role as userRole,
           m.first_name || ' ' || m.last_name AS managerName
    FROM employees e
    LEFT JOIN users u ON e.user_id = u.id
    LEFT JOIN employees m ON e.manager_employee_id = m.id
    WHERE e.tenant_id = ?
  `;
  const params: any[] = [tenantId];

  if (department) {
    sql += ' AND e.department = ?';
    params.push(department);
  }

  // Employees can only see themselves
  if (req.user!.role === 'EMPLOYEE') {
    sql += ' AND e.user_id = ?';
    params.push(req.user!.id);
  }

  // Manager sees their direct reports + themselves
  if (req.user!.role === 'MANAGER') {
    const mgr = queryOne<any>('SELECT id FROM employees WHERE user_id = ?', [req.user!.id]);
    if (mgr) {
      sql += ' AND (e.manager_employee_id = ? OR e.user_id = ?)';
      params.push(mgr.id, req.user!.id);
    }
  }

  sql += ' ORDER BY e.last_name ASC';

  const employees = queryAll<any>(sql, params);
  res.json({ employees, total: employees.length });
});

// GET /api/v1/employees/:id
router.get('/:id', (req: Request, res: Response): void => {
  const emp = queryOne<any>(
    `SELECT e.*, m.first_name || ' ' || m.last_name AS managerName, u.role as userRole
     FROM employees e
     LEFT JOIN employees m ON e.manager_employee_id = m.id
     LEFT JOIN users u ON e.user_id = u.id
     WHERE e.id = ? AND e.tenant_id = ?`,
    [req.params.id, req.user!.tenantId]
  );

  if (!emp) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  // Employees can only see themselves
  if (req.user!.role === 'EMPLOYEE' && emp.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({ employee: emp });
});

const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email address is required'),
  department: z.string().default('Operations'),
  jobTitle: z.string().default('Operations Specialist'),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN']).default('EMPLOYEE'),
});

// POST /api/v1/employees — Add new employee with auto-generated shifts & AI pipeline enablement
router.post('/', requireRole('MANAGER', 'HR_ADMIN', 'SYSTEM_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const result = CreateEmployeeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.issues });
    return;
  }

  const { firstName, lastName, email, department, jobTitle, role } = result.data;
  const tenantId = req.user!.tenantId || 'tenant-acme-corp';
  const displayName = `${firstName} ${lastName}`;

  // Check if user with email exists
  const existingUser = queryOne<any>('SELECT id FROM users WHERE email = ?', [email]);
  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    userId = `user-${Date.now().toString(36)}`;
    execute(
      `INSERT INTO users (id, tenant_id, email, display_name, role, is_active, password_hash)
       VALUES (?, ?, ?, ?, ?, 1, 'hashed_demo1234')`,
      [userId, tenantId, email, displayName, role]
    );
  }

  const emp = await setupEmployeeAndShifts({
    userId,
    tenantId,
    email,
    displayName,
    role,
    department,
    jobTitle,
  });

  res.status(201).json({
    message: `Employee ${displayName} successfully created and onboarded with 14 days of scheduled shifts and LangGraph AI pipeline readiness.`,
    employee: emp,
  });
});

export default router;
