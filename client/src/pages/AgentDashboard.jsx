import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createSession, listSessions } from '../api/session.api';
import toast from 'react-hot-toast';
import {
  Video, Plus, Copy, ExternalLink, Clock, Users, CheckCircle,
  XCircle, AlertCircle, LogOut, Shield, FileText, BarChart2
} from 'lucide-react';

function formatDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StatusBadge({ status }) {
  const map = {
    waiting: { cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30', label: 'Waiting', icon: <AlertCircle className="w-3 h-3" /> },
    active:  { cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', label: 'Live', icon: <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> },
    ended:   { cls: 'bg-slate-600/30 text-slate-500 border border-slate-600/30', label: 'Ended', icon: <XCircle className="w-3 h-3" /> },
  };
  const { cls, label, icon } = map[status] || map.ended;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}

export default function AgentDashboard() {
  const { user, token, signOut } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [inviteModal, setInviteModal] = useState(null);

  useEffect(() => { fetchSessions(); }, []);

  async function fetchSessions() {
    try {
      const res = await listSessions();
      setSessions(res.data);
    } catch {}
  }

  async function handleCreateSession() {
    setCreating(true);
    try {
      const res = await createSession();
      const { session, inviteUrl } = res.data;
      setInviteModal({ session, inviteUrl });
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  }

  function copyLink(url) {
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied!');
  }

  function joinAsAgent(session) {
    navigate(`/call/${session.session_token}`, {
      state: { role: 'agent', agentToken: token, displayName: user.name },
    });
  }

  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const waitingCount = sessions.filter((s) => s.status === 'waiting').length;

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-800 border-r border-slate-700/50 flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Videoy</p>
              <p className="text-xs text-brand-400">Live Support</p>
            </div>
          </div>
        </div>

        <nav className="p-4 flex-1 space-y-1">
          <NavItem icon={<BarChart2 />} label="Dashboard" active />
          {user?.role === 'admin' && (
            <NavItem icon={<Shield />} label="Admin Panel" onClick={() => navigate('/admin')} />
          )}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-brand-600/20 rounded-full flex items-center justify-center text-brand-400 font-bold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Manage your support sessions</p>
          </div>
          <button
            id="create-session-btn"
            onClick={handleCreateSession}
            disabled={creating}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 rounded-xl px-5 py-2.5 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-600/25"
          >
            {creating ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New Session
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Sessions" value={sessions.length} icon={<FileText />} color="blue" />
          <StatCard label="Live Now" value={activeCount} icon={<Video />} color="green" />
          <StatCard label="Awaiting Customer" value={waitingCount} icon={<Clock />} color="amber" />
        </div>

        {/* Sessions table */}
        <div className="bg-surface-800 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="font-semibold text-white">Session History</h2>
            <button onClick={fetchSessions} className="text-xs text-slate-400 hover:text-brand-400 transition-colors">Refresh</button>
          </div>
          {sessions.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No sessions yet</p>
              <p className="text-sm mt-1">Create your first session to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/40">
              {sessions.map((s) => (
                <div key={s.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-700/20 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-slate-500 mb-0.5">{s.session_token.slice(0, 12)}…</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(s.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                  <div className="text-xs text-slate-500 w-20 text-right">
                    {formatDuration(s.duration_secs)}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(s.status === 'waiting' || s.status === 'active') && (
                      <button
                        onClick={() => joinAsAgent(s)}
                        className="px-3 py-1.5 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        Join
                      </button>
                    )}
                    {s.status === 'ended' && (
                      <Link
                        to={`/sessions/${s.session_token}/summary`}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                      >
                        Summary
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Invite Modal */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-surface-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Session Created!</h3>
                <p className="text-xs text-slate-400">Share this link with your customer</p>
              </div>
            </div>

            <div className="bg-surface-900 border border-slate-700 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-500 mb-1">Invite Link</p>
              <p className="text-sm text-brand-400 break-all font-mono leading-relaxed">{inviteModal.inviteUrl}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => copyLink(inviteModal.inviteUrl)}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                <Copy className="w-4 h-4" /> Copy Link
              </button>
              <button
                onClick={() => { joinAsAgent(inviteModal.session); setInviteModal(null); }}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                <Video className="w-4 h-4" /> Join Now
              </button>
            </div>

            <button
              onClick={() => setInviteModal(null)}
              className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-600/20 text-brand-400'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      }`}
    >
      <span className="w-4 h-4">{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    blue:  { bg: 'bg-brand-500/10',   icon: 'text-brand-400',   val: 'text-brand-400' },
    green: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', val: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/10',   icon: 'text-amber-400',   val: 'text-amber-400' },
  };
  const c = colors[color];
  return (
    <div className="bg-surface-800 border border-slate-700/50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-400">{label}</p>
        <div className={`w-8 h-8 ${c.bg} rounded-lg flex items-center justify-center ${c.icon}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${c.val}`}>{value}</p>
    </div>
  );
}
