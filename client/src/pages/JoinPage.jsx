import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getSession } from '../api/session.api';
import { Video, Shield, Wifi, AlertTriangle, Loader } from 'lucide-react';

export default function JoinPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inviteToken = searchParams.get('t');

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!token || !inviteToken) {
        setError('invalid');
        setLoading(false);
        return;
      }
      try {
        const res = await getSession(token);
        if (res.data.status === 'ended') {
          setError('ended');
        } else {
          setSession(res.data);
        }
      } catch {
        setError('invalid');
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token, inviteToken]);

  function handleJoin() {
    if (!displayName.trim()) return;
    setJoining(true);
    navigate(`/call/${token}`, {
      state: {
        role: 'customer',
        inviteToken,
        displayName: displayName.trim(),
      },
    });
  }

  if (loading) return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center">
      <Loader className="w-8 h-8 text-brand-400 animate-spin" />
    </div>
  );

  if (error === 'invalid') return <ErrorCard
    icon={<AlertTriangle className="w-8 h-8 text-red-400" />}
    title="Invalid Invite Link"
    message="This invite link is invalid or has expired. Please contact your support agent for a new link."
    color="red"
  />;

  if (error === 'ended') return <ErrorCard
    icon={<Shield className="w-8 h-8 text-amber-400" />}
    title="Session Ended"
    message="This support session has already ended. Please contact your support agent if you need further assistance."
    color="amber"
  />;

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4 shadow-lg shadow-brand-600/30">
            <Video className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Videoy</h1>
        </div>

        {/* Main card */}
        <div className="bg-surface-800 border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="relative">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
              <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse-ring" />
            </div>
            <span className="text-xs font-medium text-emerald-400">Support Session Ready</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">You've been invited to a video support session</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            A support agent is waiting to help you. Enter your name below and click Join to start the session.
          </p>

          <div className="mb-5">
            <label className="text-sm text-slate-400 block mb-2">Your name</label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. John Smith"
              maxLength={50}
              className="w-full bg-surface-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 transition-colors"
            />
          </div>

          <button
            id="join-now-btn"
            onClick={handleJoin}
            disabled={!displayName.trim() || joining}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3.5 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25"
          >
            {joining ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Video className="w-4 h-4" />
            )}
            {joining ? 'Connecting…' : 'Join Now'}
          </button>
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5" /> Server-routed video</div>
          <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Secure & private</div>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ icon, title, message, color }) {
  const borderColor = color === 'red' ? 'border-red-500/30' : 'border-amber-500/30';
  const bgColor = color === 'red' ? 'bg-red-500/10' : 'bg-amber-500/10';
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className={`bg-surface-800 border ${borderColor} rounded-2xl p-8 max-w-md w-full text-center animate-fade-in`}>
        <div className={`w-16 h-16 ${bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
          {icon}
        </div>
        <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
        <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
