import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/auth.api';
import toast from 'react-hot-toast';
import { Video, Lock, Mail, Eye, EyeOff, Zap, ShieldAlert, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function AgentLogin() {
  const { signIn, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [roleSelection, setRoleSelection] = useState(null); // null | 'agent' | 'admin'
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Already logged in → redirect
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="text-center animate-fade-in">
          <p className="text-slate-300 mb-4">Logged in as <span className="text-brand-400 font-semibold">{user?.name}</span></p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-xl text-white font-medium transition-colors">
              Dashboard
            </button>
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors">
                Admin Panel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleSelectRole = (role) => {
    setRoleSelection(role);
    if (role === 'admin') {
      setForm({ email: 'admin@demo.com', password: '' });
    } else {
      setForm({ email: 'agent@demo.com', password: '' });
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Fill in all fields');
    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      signIn(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4 shadow-lg shadow-brand-600/30">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Videoy</h1>
          <p className="text-slate-400 mt-1.5 text-sm">AI-Powered Video Support Platform</p>
        </div>

        {roleSelection === null ? (
          /* Role Selection View (2 boxes) */
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold text-white">Select Portal</h2>
              <p className="text-xs text-slate-500 mt-1">Choose your workspace entry node to continue</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-5">
              {/* Agent Portal Box */}
              <button
                onClick={() => handleSelectRole('agent')}
                className="bg-surface-800 border border-slate-700/60 hover:border-brand-500 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group flex flex-col justify-between h-56 shadow-xl hover:shadow-brand-600/10 cursor-pointer"
              >
                <div className="w-12 h-12 bg-brand-600/15 group-hover:bg-brand-600/25 rounded-xl flex items-center justify-center text-brand-400 transition-colors">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">Agent Workspace</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Create instant secure sessions, launch calls, share invite links, and consult live Gemini diagnostics.
                  </p>
                </div>
              </button>

              {/* Admin Portal Box */}
              <button
                onClick={() => handleSelectRole('admin')}
                className="bg-surface-800 border border-slate-700/60 hover:border-purple-500 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] active:scale-[0.98] group flex flex-col justify-between h-56 shadow-xl hover:shadow-purple-600/10 cursor-pointer"
              >
                <div className="w-12 h-12 bg-purple-500/15 group-hover:bg-purple-500/25 rounded-xl flex items-center justify-center text-purple-400 transition-colors">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="mt-4">
                  <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">Admin Console</h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Access visual statistics charts, monitor live Mediasoup SFU channels, and audit aggregate failure cases.
                  </p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Sign In Form View */
          <div className="max-w-md mx-auto bg-surface-800 border border-slate-700/50 rounded-2xl p-8 shadow-2xl shadow-black/40 animate-slide-up">
            <button
              onClick={() => setRoleSelection(null)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to portal select
            </button>

            <h2 className="text-xl font-semibold text-white mb-6 capitalize">{roleSelection} Sign In</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full bg-surface-900 border border-slate-600 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full bg-surface-900 border border-slate-600 rounded-xl pl-10 pr-11 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl py-3 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-2 shadow-lg shadow-brand-600/25"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Demo credentials info box */}
            <div className="mt-6 p-3.5 bg-surface-900/60 rounded-xl border border-slate-700/40">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                <Zap className="w-3.5 h-3.5" />
                <span className="font-medium">Demo password for mock logins</span>
              </div>
              <div className="text-xs text-slate-400">
                <p>Use password: <span className="font-mono text-white bg-slate-800 px-1.5 py-0.5 rounded">{roleSelection === 'admin' ? 'admin1234' : 'demo1234'}</span></p>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-8">
          Videoy
        </p>
      </div>
    </div>
  );
}

