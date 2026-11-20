'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { setUser } from '@/lib/auth';
import { Spinner } from '@/components/ui/spinner';
import { ShieldCheck, Users, Briefcase, User, Sparkles, LogIn, UserPlus, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

type RoleType = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SYSTEM_ADMIN';

const quickPersonas = [
  { label: 'Sarah Chen', email: 'hr.admin@acme.com', role: 'HR_ADMIN' as RoleType, desc: 'HR Admin' },
  { label: 'David Miller', email: 'mgr.ops@acme.com', role: 'MANAGER' as RoleType, desc: 'Ops Manager' },
  { label: 'Lisa Park', email: 'mgr.tech@acme.com', role: 'MANAGER' as RoleType, desc: 'Tech Manager' },
  { label: 'Alice Johnson', email: 'alice.johnson@acme.com', role: 'EMPLOYEE' as RoleType, desc: 'Employee' },
];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [email, setEmail] = useState('mgr.ops@acme.com');
  const [password, setPassword] = useState('demo1234');
  const [role, setRole] = useState<RoleType>('MANAGER');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('Operations');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Quick fill helper
  function selectQuickPersona(p: typeof quickPersonas[0]) {
    setEmail(p.email);
    setPassword('demo1234');
    setRole(p.role);
    setTab('login');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { token, user } = await api.login(email, password, role);
      setToken(token);
      setUser(user);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please provide your full name.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { token, user } = await api.register({
        email,
        password,
        displayName: displayName.trim(),
        role,
        department,
      });
      setToken(token);
      setUser(user);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-gentle" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse-gentle" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl mb-3 text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
            AW
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AttendWise AI</h1>
          <p className="text-slate-400 text-xs mt-1 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Agentic Time & Attendance Exception Management
          </p>
        </div>

        {/* Quick Demo Persona Pills (Clean & Reduced) */}
        <div className="mb-5 bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
            ⚡ Quick-Fill Demo Personas
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickPersonas.map((p) => {
              const isSelected = email === p.email && role === p.role;
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => selectQuickPersona(p)}
                  className={clsx(
                    'flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left border',
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-900/30'
                      : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10 hover:border-white/15'
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="truncate font-semibold">{p.label}</div>
                    <div className="text-[10px] text-slate-300/80">{p.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 border border-slate-100">
          {/* Tab Switcher: Log In vs Sign In / Register */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                tab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <LogIn className="w-3.5 h-3.5" />
              Log In
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all',
                tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sign In / Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  required={tab === 'register'}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@acme.com"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                required
              />
            </div>

            {/* Role Selection Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleType)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition-colors"
              >
                <option value="EMPLOYEE">Employee (Self-Service & Punches)</option>
                <option value="MANAGER">Manager (Team Approvals & Exceptions)</option>
                <option value="HR_ADMIN">HR Admin (Org-wide Governance & Policies)</option>
                <option value="SYSTEM_ADMIN">System Admin (Platform Operations)</option>
              </select>
            </div>

            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Operations, Technology, HR"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 text-xs px-3.5 py-3 rounded-xl border border-red-200 space-y-1.5 animate-fade-in">
                <div className="font-medium">{error}</div>
                {tab === 'login' && (error.toLowerCase().includes('not found') || error.toLowerCase().includes('invalid credentials')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('register');
                      setError('');
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 underline cursor-pointer text-[11px]"
                  >
                    New user? Click here to register your account →
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  {tab === 'login' ? 'Authenticating…' : 'Registering…'}
                </>
              ) : tab === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Log In as {role.replace(/_/g, ' ')}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Sign In as {role.replace(/_/g, ' ')}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          AttendWise AI • DayForce Innovation Challenge
        </p>
      </div>
    </div>
  );
}
