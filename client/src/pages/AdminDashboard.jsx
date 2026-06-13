import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLiveSessions, forceEndSession, getStats } from '../api/admin.api';
import { getOverview, getTopIssues } from '../api/intelligence.api';
import { getAdminSocket } from '../socket/socket.js';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Shield, Video, Users, Clock, XCircle, RefreshCw,
  LogOut, Activity, BarChart2, Zap, Award, BookOpen, AlertTriangle
} from 'lucide-react';

function formatDuration(startedAt) {
  if (!startedAt) return '—';
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default function AdminDashboard() {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('live'); // live | intelligence
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total_sessions: 0, active_sessions: 0 });
  const [intelOverview, setIntelOverview] = useState(null);
  const [topIssues, setTopIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [, forceRender] = useState(0);
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchAll();

    // Socket for real-time updates
    const socket = getAdminSocket(token);
    socketRef.current = socket;

    socket.on('admin:sessionUpdate', ({ sessions: liveSessions }) => {
      setSessions(liveSessions || []);
      setLastRefresh(new Date());
    });

    socket.on('connect_error', () => {
      startPolling();
    });

    // Tick timer to update durations
    timerRef.current = setInterval(() => forceRender((n) => n + 1), 1000);

    return () => {
      clearInterval(timerRef.current);
      socket.off('admin:sessionUpdate');
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'intelligence') {
      fetchIntelligence();
    }
  }, [activeTab]);

  function startPolling() {
    setInterval(fetchAll, 5000);
  }

  async function fetchAll() {
    try {
      const [sessRes, statsRes] = await Promise.all([getLiveSessions(), getStats()]);
      setSessions(sessRes.data);
      setStats(statsRes.data);
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); }
  }

  async function fetchIntelligence() {
    setLoading(true);
    try {
      const [overviewRes, issuesRes] = await Promise.all([getOverview(), getTopIssues()]);
      setIntelOverview(overviewRes.data);
      setTopIssues(issuesRes.data);
    } catch (err) {
      toast.error('Failed to load product intelligence');
    } finally {
      setLoading(false);
    }
  }

  async function handleForceEnd(sessionToken, e) {
    e.stopPropagation();
    if (!confirm('Force-end this session? An AI summary will be generated.')) return;
    try {
      await forceEndSession(sessionToken);
      toast.success('Session ended');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end session');
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-800 border-r border-slate-700/50 flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Admin Panel</p>
              <p className="text-xs text-brand-400">Videoy</p>
            </div>
          </div>
        </div>

        <nav className="p-4 flex-1 space-y-1">
          <SideNavItem
            icon={<Activity />}
            label="Live Sessions"
            active={activeTab === 'live'}
            onClick={() => setActiveTab('live')}
          />
          <SideNavItem
            icon={<BarChart2 />}
            label="Intelligence"
            active={activeTab === 'intelligence'}
            onClick={() => setActiveTab('intelligence')}
          />
          <div className="pt-4 mt-4 border-t border-slate-700/40">
            <SideNavItem
              icon={<BookOpen />}
              label="Agent View"
              onClick={() => navigate('/dashboard')}
            />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {activeTab === 'live' ? <Activity className="w-6 h-6 text-brand-500" /> : <BarChart2 className="w-6 h-6 text-brand-500" />}
              {activeTab === 'live' ? 'Live Sessions Monitor' : 'Product Intelligence Hub'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {activeTab === 'live' ? `Real-time — Last updated ${lastRefresh.toLocaleTimeString()}` : 'Compound support statistics & visual diagnostics insight'}
            </p>
          </div>
          <button
            onClick={activeTab === 'live' ? fetchAll : fetchIntelligence}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {activeTab === 'live' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <StatCard label="Total Sessions" value={stats.total_sessions} icon={<Video />} />
              <StatCard label="Live Right Now" value={stats.active_sessions} icon={<Zap />} accent />
              <StatCard label="Monitoring" value="Active" icon={<Activity />} />
            </div>

            {/* Live sessions table */}
            <div className="bg-surface-800 border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Active Sessions
                </h2>
                <span className="text-xs text-slate-500">{sessions.length} active</span>
              </div>

              {loading ? (
                <div className="py-16 text-center">
                  <RefreshCw className="w-8 h-8 text-slate-600 animate-spin mx-auto" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-slate-400">No active sessions</p>
                  <p className="text-sm mt-1 text-slate-500">Live sessions will appear here automatically</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Session</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Participants</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-mono text-xs text-slate-400">{s.session_token?.slice(0, 12)}…</p>
                            <p className="text-xs text-slate-600 mt-0.5">{new Date(s.created_at).toLocaleString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-white font-medium">{s.agent_name}</p>
                            <p className="text-xs text-slate-500">{s.agent_email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-white">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {s.participant_count ?? '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-300">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {formatDuration(s.started_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              id={`end-session-${s.id}`}
                              onClick={(e) => handleForceEnd(s.session_token, e)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" /> End Session
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* INTELLIGENCE VIEW */
          <div className="space-y-8 animate-fade-in">
            {intelOverview && (
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Total Sessions" value={intelOverview.total_sessions} icon={<Video />} />
                <StatCard label="Avg. Call Duration" value={`${Math.round(intelOverview.avg_duration_secs / 60)} min`} icon={<Clock />} />
                <StatCard label="Unresolved Rate" value={`${intelOverview.unresolved_rate}%`} icon={<AlertTriangle className="text-red-400" />} />
                <StatCard label="Top Product" value={intelOverview.top_products?.[0]?.product_detected || 'None'} icon={<Award />} accent />
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-6">
              {/* Daily Session Chart */}
              <div className="md:col-span-2 bg-surface-800 border border-slate-700/50 rounded-2xl p-6 shadow-xl">
                <h3 className="font-semibold text-white mb-6 text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-400" />
                  Support Sessions Volume (Last 7 Days)
                </h3>
                <div className="h-64">
                  {intelOverview?.sessions_per_day ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={intelOverview.sessions_per_day}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#f1f5f9' }} />
                        <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-slate-500 text-xs italic text-center pt-20">No history stats</p>
                  )}
                </div>
              </div>

              {/* Top Issues List */}
              <div className="bg-surface-800 border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col">
                <h3 className="font-semibold text-white mb-4 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-brand-400" />
                  Top Defect / Failure Modes
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {topIssues.length === 0 ? (
                    <p className="text-slate-500 text-xs italic text-center pt-16">No issues analyzed yet</p>
                  ) : (
                    topIssues.map((issue, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-surface-900/40 border border-slate-700/30 rounded-xl px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{issue.issue_identified}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Defect count: {issue.count}</p>
                        </div>
                        <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                          #{idx + 1}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SideNavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active ? 'bg-brand-600/20 text-brand-400 font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      }`}
    >
      <span className="w-4 h-4">{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className={`border rounded-2xl p-5 ${accent ? 'bg-brand-600/10 border-brand-600/20' : 'bg-surface-800 border-slate-700/50'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-400">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-brand-600/20 text-brand-400' : 'bg-slate-700 text-slate-400'}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${accent ? 'text-brand-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

