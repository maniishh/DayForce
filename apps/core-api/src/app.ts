import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initSchema } from './db/database.js';

import authRoutes         from './routes/auth.js';
import employeeRoutes     from './routes/employees.js';
import attendanceRoutes   from './routes/attendance.js';
import exceptionRoutes    from './routes/exceptions.js';
import approvalRoutes     from './routes/approvals.js';
import dashboardRoutes    from './routes/dashboard.js';
import auditRoutes        from './routes/audit.js';
import notificationRoutes from './routes/notifications.js';
import workflowRoutes     from './routes/workflow.js';
import policyRoutes       from './routes/policies.js';
import shiftRoutes        from './routes/shifts.js';

export function createApp(): Express {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

  // Init DB schema on startup
  try { initSchema(); } catch (e) { console.warn('[DB] Schema init warning:', e); }

  // Health
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', service: 'AttendWise Core API', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/v1/auth',          authRoutes);
  app.use('/api/v1/employees',     employeeRoutes);
  app.use('/api/v1/attendance',    attendanceRoutes);
  app.use('/api/v1/exceptions',    exceptionRoutes);
  app.use('/api/v1/approvals',     approvalRoutes);
  app.use('/api/v1/dashboard',     dashboardRoutes);
  app.use('/api/v1/audit',         auditRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/policies',     policyRoutes);
  app.use('/api/v1/shifts',       shiftRoutes);
  app.use('/', workflowRoutes);

  // 404
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });

  return app;
}
