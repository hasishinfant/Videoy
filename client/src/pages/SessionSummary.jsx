import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSessionSummary } from '../api/session.api';
import { ArrowLeft, Users, Clock, MessageSquare, Sparkles, Calendar, Loader } from 'lucide-react';

function formatDuration(secs) {
  if (!secs) return 'N/A';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function SessionSummary() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getSessionSummary(token);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <Loader className="w-8 h-8 text-brand-400 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="text-brand-400 hover:underline text-sm">← Go back</button>
      </div>
    </div>
  );

  const { session, summary, participants } = data;
  const chatMessages = data.chatHistory || [];

  const sentimentColor = {
    positive: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    neutral:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
    negative: 'text-red-400 bg-red-500/10 border-red-500/20',
  }[summary?.sentiment] || 'text-slate-400 bg-slate-700 border-slate-600';

  return (
    <div className="min-h-screen bg-surface-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* Header */}
        <div className="bg-surface-800 border border-slate-700/50 rounded-2xl p-6 mb-5 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 font-mono mb-1">{session.session_token}</p>
              <h1 className="text-xl font-bold text-white">Session Summary</h1>
            </div>
            <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs font-medium capitalize">
              {session.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <MetaItem icon={<Calendar className="w-4 h-4" />} label="Date" value={new Date(session.created_at).toLocaleDateString()} />
            <MetaItem icon={<Clock className="w-4 h-4" />} label="Duration" value={formatDuration(session.duration_secs)} />
            <MetaItem icon={<Users className="w-4 h-4" />} label="Participants" value={participants?.length || '—'} />
            <MetaItem icon={<MessageSquare className="w-4 h-4" />} label="Messages" value={chatMessages.length} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* AI Summary */}
          {summary ? (
            <div className="bg-gradient-to-br from-brand-900/40 to-purple-900/20 border border-brand-700/40 rounded-2xl p-6 animate-slide-up">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-brand-600/30 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-white text-sm">AI Summary</h2>
                  <p className="text-xs text-slate-400">Gemini Flash</p>
                </div>
                {summary.sentiment && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${sentimentColor}`}>
                    {summary.sentiment}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-5">{summary.summary}</p>

              <div className="space-y-4">
                <SumSection label="Issue Detected" color="red">
                  <p className="text-sm">{summary.issue_detected}</p>
                </SumSection>
                <SumSection label="Resolution Steps" color="blue">
                  {summary.resolution_steps?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {summary.resolution_steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="flex-shrink-0 w-5 h-5 bg-brand-500/30 text-brand-400 rounded-full text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm italic text-slate-500">None recorded</p>}
                </SumSection>
                <SumSection label="Action Items" color="amber">
                  {summary.action_items?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {summary.action_items.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm italic text-slate-500">None recorded</p>}
                </SumSection>
              </div>
            </div>
          ) : (
            <div className="bg-surface-800 border border-slate-700/50 rounded-2xl p-6 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No AI summary available</p>
              </div>
            </div>
          )}

          {/* Chat Transcript */}
          <div className="bg-surface-800 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-400" />
              <h2 className="font-semibold text-white text-sm">Chat Transcript</h2>
              <span className="ml-auto text-xs text-slate-500">{chatMessages.length} messages</span>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {chatMessages.length === 0 ? (
                <p className="text-center text-slate-600 text-sm py-8">No chat messages</p>
              ) : chatMessages.map((m, i) => (
                <div key={i} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-white">{m.sender_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      m.sender_role === 'agent' ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-700 text-slate-400'
                    }`}>{m.sender_role}</span>
                    <span className="text-[10px] text-slate-600 ml-auto">
                      {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 pl-0 bg-surface-900/50 rounded-xl px-3 py-2 border border-slate-700/50">
                    {m.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Participants */}
        {participants?.length > 0 && (
          <div className="bg-surface-800 border border-slate-700/50 rounded-2xl p-5 mt-5">
            <h2 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-400" /> Participants
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-surface-900/50 border border-slate-700/50 rounded-xl px-3 py-2.5">
                  <div className="w-8 h-8 bg-brand-600/20 rounded-full flex items-center justify-center text-brand-400 font-bold text-sm">
                    {p.display_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.display_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{p.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value }) {
  return (
    <div className="bg-surface-900/50 rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-semibold text-white text-sm">{value}</p>
    </div>
  );
}

function SumSection({ label, color, children }) {
  const colors = {
    red:   'border-red-500/20 text-red-300',
    blue:  'border-brand-500/20 text-brand-300',
    amber: 'border-amber-500/20 text-amber-300',
  };
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className={`border rounded-xl p-3 ${colors[color]}`}>{children}</div>
    </div>
  );
}
