'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  Users, Search, Briefcase, Mail, Building2, UserCheck,
  LayoutList, LayoutGrid, X, CheckCircle2, Shield, ArrowRight,
  BadgeCheck, Fingerprint, Calendar, Phone, Sparkles, Lock, UserPlus
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { getUser } from '@/lib/auth';

export default function EmployeesPage() {
  const [emps, setEmps] = useState<any[]>([]);
  const [loading, setL] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const user = getUser();
  const isEmployee = user?.role === 'EMPLOYEE';
  const canAddEmployee = user?.role === 'MANAGER' || user?.role === 'HR_ADMIN' || user?.role === 'SYSTEM_ADMIN';

  // Add Employee Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [jobTitle, setJobTitle] = useState('Operations Specialist');
  const [newRole, setNewRole] = useState<'EMPLOYEE' | 'MANAGER'>('EMPLOYEE');
  const [saving, setSaving] = useState(false);

  // Shift Assignment Modal state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [selectedEmpForShift, setSelectedEmpForShift] = useState<any>(null);
  const [shiftStartDate, setShiftStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shiftEndDate, setShiftEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [shiftStartTime, setShiftStartTime] = useState('09:00');
  const [shiftEndTime, setShiftEndTime] = useState('17:00');
  const [shiftBreakMins, setShiftBreakMins] = useState(30);
  const [shiftType, setShiftType] = useState<'REGULAR' | 'OVERNIGHT' | 'ON_CALL'>('REGULAR');
  const [assigningShift, setAssigningShift] = useState(false);

  const { success, error: showError } = useToast();

  function openAssignShiftModal(emp: any) {
    setSelectedEmpForShift(emp);
    setShiftModalOpen(true);
  }

  async function handleAssignShift(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmpForShift) return;
    setAssigningShift(true);
    try {
      const res = await api.assignShift({
        employeeId: selectedEmpForShift.id,
        startDate: shiftStartDate,
        endDate: shiftEndDate,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
        breakMinutes: shiftBreakMins,
        shiftType,
      });
      success('Shift Timings Assigned', res.message || `Assigned ${shiftStartTime} - ${shiftEndTime} to ${selectedEmpForShift.first_name}.`);
      setShiftModalOpen(false);
    } catch (err: any) {
      showError('Assignment Failed', err.message);
    } finally {
      setAssigningShift(false);
    }
  }

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      showError('Validation Error', 'Please provide first name, last name, and email.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createEmployee({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        department,
        jobTitle,
        role: newRole,
      });
      success('Employee Added', res.message || `${firstName} ${lastName} has been added.`);
      setModalOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      const r = await api.employees();
      setEmps(r.employees || []);
    } catch (err: any) {
      showError('Creation Failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (isEmployee) {
      setL(false);
      return;
    }
    api.employees().then((r) => {
      setEmps(r.employees || []);
      setL(false);
    }).catch((e) => {
      console.error(e);
      setL(false);
    });
  }, []);

  const departments = [...new Set(emps.map((e) => e.department).filter(Boolean))];

  const filtered = emps.filter((e) => {
    const matchSearch = !search || `${e.first_name} ${e.last_name} ${e.department} ${e.job_title} ${e.email} ${e.employee_code}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || e.department === deptFilter;
    const matchStatus = !statusFilter || e.employment_status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const totalEmployees = emps.length;
  const activeCount = emps.filter((e) => e.employment_status === 'ACTIVE').length;
  const onLeaveCount = emps.filter((e) => e.employment_status === 'ON_LEAVE').length;

  const statusColors: Record<string, { bg: string; dot: string; text: string; border: string }> = {
    ACTIVE: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      border: 'border-emerald-200',
    },
    TERMINATED: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      dot: 'bg-red-500',
      border: 'border-red-200',
    },
    ON_LEAVE: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      border: 'border-amber-200',
    },
  };

  const getAvatarBg = (dept: string) => {
    const colors = [
      'from-indigo-500 to-violet-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
    ];
    let hash = 0;
    for (let i = 0; i < (dept || '').length; i++) hash += dept.charCodeAt(i);
    return colors[hash % colors.length];
  };

  if (isEmployee) {
    return (
      <div className="w-full max-w-[1536px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-5">Employee Directory</h1>
        <Card>
          <CardBody>
            <EmptyState
              icon={Lock}
              title="Access Restricted"
              description="The Organization Employee Directory is restricted to Department Managers and HR Administrators. Employees can review their personal punch events and shifts in Attendance & Punches."
              action={
                <Link
                  href="/attendance"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Go to Attendance & Punches <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1536px] mx-auto p-6 md:p-8 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Employee Directory</h1>
            <Badge variant="indigo" className="font-semibold">{filtered.length} Personnel</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Workforce personnel profiles, departmental hierarchy, and assigned supervisors
          </p>
        </div>

        {/* View Switcher & Add Button */}
        <div className="flex items-center gap-3">
          {canAddEmployee && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-200 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Employee</span>
            </button>
          )}

          <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-white shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
              title="Table View with Explicit Row Cards"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Separated Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Headcount" value={totalEmployees} icon={Users} color="blue" />
        <StatCard label="Active Personnel" value={activeCount} icon={CheckCircle2} color="emerald" />
        <StatCard label="Departments" value={departments.length} icon={Building2} color="indigo" />
        <StatCard label="On Leave" value={onLeaveCount} icon={Briefcase} color="amber" subtitle="Authorized absences" />
      </div>

      {/* Filters Card */}
      <Card>
        <CardBody className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name, ID code, job title, or email…"
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300 transition-colors bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="">Department: All</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value="">Status: All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_LEAVE">ON LEAVE</option>
              <option value="TERMINATED">TERMINATED</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Main Content: Table or Cards */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Users}
              title="No employees match your search"
              description="Try adjusting your search terms or clearing department filters."
              action={
                (search || deptFilter || statusFilter) ? (
                  <button
                    onClick={() => { setSearch(''); setDeptFilter(''); setStatusFilter(''); }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Reset all filters
                  </button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW WITH UNMISTAKABLE SEPARATION (ISOLATED ROW CAPSULES) */
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-y-3">
            <thead>
              <tr className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-5 pb-1 text-left">Employee Record</th>
                <th className="px-5 pb-1 text-left">Role & Title</th>
                <th className="px-5 pb-1 text-left">Department</th>
                <th className="px-5 pb-1 text-left">Reporting Supervisor</th>
                <th className="px-5 pb-1 text-left">Contact Channel</th>
                <th className="px-5 pb-1 text-left">Employment Status</th>
                <th className="px-5 pb-1 text-right">Work Timings</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, idx) => {
                const sc = statusColors[emp.employment_status] || statusColors.ACTIVE;
                const initials = `${(emp.first_name || '')[0] || ''}${(emp.last_name || '')[0] || ''}`.toUpperCase();

                return (
                  <tr
                    key={`${emp.id}-${idx}`}
                    className="bg-white hover:bg-indigo-50/20 transition-all duration-150 group shadow-sm hover:shadow-md"
                  >
                    {/* Leftmost Cell with Rounded Left Boundary & Left Border */}
                    <td className="px-5 py-4 rounded-l-2xl border-y-2 border-l-2 border-slate-200/90 group-hover:border-indigo-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-10 h-10 rounded-xl bg-gradient-to-br text-white font-extrabold text-sm flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white',
                          getAvatarBg(emp.department)
                        )}>
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm flex items-center gap-1.5">
                            {emp.first_name} {emp.last_name}
                            <BadgeCheck className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              {emp.employee_code}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Job Title Cell with Top/Bottom Borders */}
                    <td className="px-5 py-4 border-y-2 border-slate-200/90 group-hover:border-indigo-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-xs">{emp.job_title}</div>
                          <div className="text-[11px] text-slate-400">Designated Role</div>
                        </div>
                      </div>
                    </td>

                    {/* Department Cell */}
                    <td className="px-5 py-4 border-y-2 border-slate-200/90 group-hover:border-indigo-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          {emp.department}
                        </span>
                      </div>
                    </td>

                    {/* Supervisor Cell */}
                    <td className="px-5 py-4 border-y-2 border-slate-200/90 group-hover:border-indigo-300 transition-colors">
                      {emp.managerName ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                            <UserCheck className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-xs">{emp.managerName}</div>
                            <div className="text-[11px] text-slate-400">Direct Manager</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Direct Executive</span>
                      )}
                    </td>

                    {/* Contact Email Cell */}
                    <td className="px-5 py-4 border-y-2 border-slate-200/90 group-hover:border-indigo-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs text-slate-700 font-mono">{emp.email}</span>
                      </div>
                    </td>

                    {/* Status Cell */}
                    <td className="px-5 py-4 border-y-2 border-slate-200/90 group-hover:border-indigo-300 transition-colors">
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-xs',
                        sc.bg, sc.text, sc.border
                      )}>
                        <span className={clsx('w-2 h-2 rounded-full', sc.dot, emp.employment_status === 'ACTIVE' && 'animate-pulse')} />
                        {emp.employment_status}
                      </span>
                    </td>

                    {/* Rightmost Cell with Shift Assignment Action */}
                    <td className="px-5 py-4 rounded-r-2xl border-y-2 border-r-2 border-slate-200/90 group-hover:border-indigo-300 transition-colors text-right">
                      {canAddEmployee ? (
                        <button
                          onClick={() => openAssignShiftModal(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Assign Timings</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Scheduled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD GRID VIEW WITH CRISP ELEVATED BORDERS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp, idx) => {
            const sc = statusColors[emp.employment_status] || statusColors.ACTIVE;
            const initials = `${(emp.first_name || '')[0] || ''}${(emp.last_name || '')[0] || ''}`.toUpperCase();

            return (
              <div
                key={`${emp.id}-${idx}`}
                className="bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-400 p-5 shadow-sm hover:shadow-md transition-all space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-11 h-11 rounded-xl bg-gradient-to-br text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-xs ring-1 ring-black/5',
                      getAvatarBg(emp.department)
                    )}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {emp.first_name} {emp.last_name}
                        <BadgeCheck className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {emp.employee_code}
                      </span>
                    </div>
                  </div>

                  <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border', sc.bg, sc.text, sc.border)}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full', sc.dot)} />
                    {emp.employment_status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Department:
                    </span>
                    <span className="font-semibold text-slate-900">{emp.department}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Briefcase className="w-3.5 h-3.5 text-blue-500" /> Role:
                    </span>
                    <span className="font-medium text-slate-800">{emp.job_title}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Supervisor:
                    </span>
                    <span className="font-medium text-slate-800">{emp.managerName || 'Executive'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-50">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 truncate max-w-[170px]">{emp.email}</span>
                  </div>

                  {canAddEmployee && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        onClick={() => openAssignShiftModal(emp)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Assign Shift Timings</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New Employee"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <p className="text-xs text-slate-500">
            Create an employee profile. A user account with 14 days of scheduled shifts and automatic LangGraph AI anomaly monitoring will be configured automatically.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Doe"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john.doe@acme.com"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Operations">Operations</option>
                <option value="Technology">Technology</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Logistics">Logistics</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Operations Coordinator"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed">
            <span className="font-semibold">Default Password:</span> <code>demo1234</code>. The new employee can immediately log in, use the Web Punch clock, and have their attendance analyzed by the AI pipeline.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-60 transition-all cursor-pointer"
            >
              {saving ? <Spinner size="sm" /> : <UserPlus className="w-4 h-4" />}
              {saving ? 'Creating & Generating Shifts…' : 'Add Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Shift Timings Modal */}
      <Modal
        open={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={`Assign Shift Timings: ${selectedEmpForShift ? `${selectedEmpForShift.first_name} ${selectedEmpForShift.last_name}` : ''}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAssignShift} className="space-y-4">
          {selectedEmpForShift && (
            <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800">
                {selectedEmpForShift.first_name} {selectedEmpForShift.last_name} ({selectedEmpForShift.employee_code})
              </div>
              <div className="text-slate-500">
                Department: {selectedEmpForShift.department} • Role: {selectedEmpForShift.job_title}
              </div>
              <p className="text-[11px] text-indigo-700 pt-0.5">
                Assigned shift timings determine the employee&apos;s punctuality baseline. Lateness is measured after a 10m grace period, and unclosed punches exceeding 1.5x shift duration trigger automatic AI anomaly investigation.
              </p>
            </div>
          )}

          {/* Quick Shift Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quick Presets</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '🌅 09:00 – 17:00', start: '09:00', end: '17:00', name: 'Standard Day' },
                { label: '⛅ 08:00 – 16:00', start: '08:00', end: '16:00', name: 'Early Bird' },
                { label: '☀️ 10:00 – 18:00', start: '10:00', end: '18:00', name: 'Midday Core' },
                { label: '🌙 23:00 – 07:00', start: '23:00', end: '07:00', name: 'Overnight' },
              ].map((preset) => (
                <button
                  key={preset.start}
                  type="button"
                  onClick={() => {
                    setShiftStartTime(preset.start);
                    setShiftEndTime(preset.end);
                  }}
                  className={clsx(
                    'p-2 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer',
                    shiftStartTime === preset.start && shiftEndTime === preset.end
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-800 font-semibold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  )}
                >
                  <div>{preset.label}</div>
                  <div className="text-[10px] text-slate-400">{preset.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Start Time (Local) *</label>
              <input
                type="time"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shift End Time (Local) *</label>
              <input
                type="time"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Effective From Date *</label>
              <input
                type="date"
                value={shiftStartDate}
                onChange={(e) => setShiftStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Apply Through Date *</label>
              <input
                type="date"
                value={shiftEndDate}
                onChange={(e) => setShiftEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Break Duration (Mins)</label>
              <input
                type="number"
                value={shiftBreakMins}
                onChange={(e) => setShiftBreakMins(parseInt(e.target.value) || 0)}
                min={0}
                max={180}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Shift Category</label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="REGULAR">Regular Shift</option>
                <option value="OVERNIGHT">Overnight Shift</option>
                <option value="ON_CALL">On-Call Shift</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShiftModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assigningShift}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-60 transition-all cursor-pointer"
            >
              {assigningShift ? <Spinner size="sm" /> : <Calendar className="w-4 h-4" />}
              {assigningShift ? 'Assigning Shifts…' : 'Save Shift Timings'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
