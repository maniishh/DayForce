const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('aw_token');
}

export function setToken(token: string) {
  localStorage.setItem('aw_token', token);
}

export function clearToken() {
  localStorage.removeItem('aw_token');
  localStorage.removeItem('aw_user');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutMs = (options as any).timeout || 45000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401) {
      const err = await res.json().catch(() => ({}));
      if (path !== '/api/v1/auth/login' && path !== '/api/v1/auth/register') {
        clearToken();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
      throw new Error(err.error || 'Invalid credentials or unauthorized');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export const api = {
  // Auth
  login:     (email: string, password: string, role?: string) =>
    request<{ token: string; user: any }>('/api/v1/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password, role }),
    }),
  register:  (data: { email: string; password: string; displayName: string; role?: string; department?: string }) =>
    request<{ token: string; user: any; message: string }>('/api/v1/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    }),
  me:        () => request<{ user: any }>('/api/v1/auth/me'),
  demoUsers: () => request<{ users: any[]; note: string }>('/api/v1/auth/demo-users'),

  // Dashboard
  kpis:      () => request<any>('/api/v1/dashboard/kpis'),

  // Employees
  employees: (dept?: string) => request<any>(`/api/v1/employees${dept ? `?department=${dept}` : ''}`),
  employee:  (id: string)    => request<any>(`/api/v1/employees/${id}`),
  createEmployee: (data: any) =>
    request<{ employee: any; message: string }>('/api/v1/employees', {
      method: 'POST', body: JSON.stringify(data),
    }),

  // Shifts & Work Schedule Management
  myShift: () => request<any>('/api/v1/shifts/my-shift'),
  shifts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/api/v1/shifts${qs}`);
  },
  assignShift: (data: {
    employeeId: string;
    startDate: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    shiftType?: string;
  }) =>
    request<{ success: boolean; message: string; assignedDates: string[]; employeeName: string }>('/api/v1/shifts/assign', {
      method: 'POST', body: JSON.stringify(data),
    }),

  // Attendance
  attendance: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/api/v1/attendance${qs}`);
  },
  punchStatus: () => request<{ isClockedIn: boolean; currentRecord: any; lastRecord: any; employeeName?: string }>('/api/v1/attendance/punch-status'),
  punch: (action: 'IN' | 'OUT', notes?: string) =>
    request<{ success: boolean; action: string; message: string; recordId: string }>('/api/v1/attendance/punch', {
      method: 'POST', body: JSON.stringify({ action, notes }),
    }),
  scan: (startDate: string, endDate: string) =>
    request<any>('/api/v1/attendance/scan', {
      method: 'POST', body: JSON.stringify({ startDate, endDate }),
    }),

  // Exceptions
  exceptions: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/api/v1/exceptions${qs}`);
  },
  exception:    (id: string) => request<any>(`/api/v1/exceptions/${id}`),
  investigate:  (id: string) => request<any>(`/api/v1/exceptions/${id}/investigate`, { method: 'POST' }),
  cancelException: (id: string, reason?: string) =>
    request<any>(`/api/v1/exceptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Approvals
  approvals:      (status?: string) =>
    request<any>(`/api/v1/approvals${status ? `?status=${status}` : ''}`),
  submitDecision: (approvalId: string, decision: string, comment?: string) =>
    request<any>(`/api/v1/approvals/${approvalId}/decision`, {
      method: 'POST', body: JSON.stringify({ decision, decisionComment: comment }),
    }),

  // Audit
  audit: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/api/v1/audit${qs}`);
  },

  // Notifications
  notifications: (status?: string) =>
    request<any>(`/api/v1/notifications${status ? `?status=${status}` : ''}`),
  markRead: (id: string) =>
    request<any>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () =>
    request<any>('/api/v1/notifications/mark-all-read', { method: 'POST' }),
  createTestNotification: () =>
    request<any>('/api/v1/notifications/create-test', { method: 'POST' }),

  // Policies
  policies: () => request<{ documents: any[] }>('/api/v1/policies'),
  policy: (id: string) => request<{ document: any; chunks: any[] }>(`/api/v1/policies/${id}`),
  createPolicy: (data: {
    title: string;
    category: string;
    content: string;
    version?: string;
    effectiveFrom?: string;
    location?: string;
  }) =>
    request<any>('/api/v1/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
