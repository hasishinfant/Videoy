import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Device } from 'mediasoup-client';
import { getCallSocket, disconnectCallSocket } from '../socket/socket.js';
import toast from 'react-hot-toast';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare,
  Send, Users, Circle, Loader, Sparkles, X
} from 'lucide-react';

export default function CallRoom() {
  const { sessionId } = useParams();  // actually the session token
  const location = useLocation();
  const navigate = useNavigate();

  const { role = 'customer', agentToken, inviteToken, displayName = 'Anonymous' } = location.state || {};

  // Media state
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: { stream, displayName } }
  const [callStatus, setCallStatus] = useState('connecting'); // connecting | active | ended
  const [participants, setParticipants] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [chatOpen, setChatOpen] = useState(true);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Tab & AI states
  const [activeTab, setActiveTab] = useState('chat');
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotAsking, setCopilotAsking] = useState(false);
  const [copilotSuggestions, setCopilotSuggestions] = useState([]);
  const [visionDetections, setVisionDetections] = useState([]);

  // Refs for mediasoup objects
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const audioProducerRef = useRef(null);
  const videoProducerRef = useRef(null);
  const consumersRef = useRef({});  // { producerId: consumer }
  const localVideoRef = useRef(null);

  const askCopilot = () => {
    if (!copilotInput.trim() || !socketRef.current) return;
    setCopilotAsking(true);
    socketRef.current.emit('copilot-ask', { question: copilotInput.trim() }, (res) => {
      setCopilotAsking(false);
      if (res?.error) {
        toast.error(res.error);
      } else {
        setCopilotInput('');
      }
    });
  };

  // ── Startup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!location.state) {
      toast.error('Invalid call session state');
      navigate('/');
      return;
    }
    startCall();
    return () => cleanup();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Capture customer frames silently every 5 seconds
  useEffect(() => {
    if (role !== 'customer') return;
    
    const interval = setInterval(() => {
      if (!localVideoRef.current || !socketRef.current || videoOff) return;
      
      try {
        const video = localVideoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Image = canvas.toDataURL('image/jpeg', 0.7);
          socketRef.current.emit('vision-frame', { imageBase64: base64Image });
        }
      } catch (err) {
        console.error('Failed to capture local video frame:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [role, videoOff, localStream]);

  async function startCall() {
    try {
      // 1. Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Connect socket
      const auth = role === 'agent'
        ? { token: agentToken }
        : { inviteToken };

      const socket = getCallSocket(auth);
      socketRef.current = socket;
      setupSocketListeners(socket, stream);

      // 3. Join room
      socket.emit('room:join', { sessionToken: sessionId, displayName }, (res) => {
        if (res?.error) {
          toast.error(res.error);
          navigate(-1);
          return;
        }
        setParticipants(res.participants || []);
        if (res.chatHistory) setMessages(res.chatHistory.map(normalizeMsg));
        setCallStatus('active');
        initMediasoup(socket, stream);
      });
    } catch (err) {
      console.error('Call start error:', err);
      toast.error(`Failed to start call: ${err.message}`);
      setCallStatus('ended');
    }
  }

  async function initMediasoup(socket, stream) {
    try {
      // Get router RTP capabilities
      socket.emit('media:getRouterCapabilities', {}, async (res) => {
        if (res?.error) return console.error('getRouterCapabilities error:', res.error);

        const device = new Device();
        await device.load({ routerRtpCapabilities: res.rtpCapabilities });
        deviceRef.current = device;

        // Create send transport
        socket.emit('media:createTransport', { direction: 'send' }, async (tRes) => {
          if (tRes?.error) return console.error('createTransport (send) error:', tRes.error);

          const sendTransport = device.createSendTransport(tRes);
          sendTransportRef.current = sendTransport;

          sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socket.emit('media:connectTransport', { transportId: sendTransport.id, dtlsParameters }, (r) => {
              r?.error ? errback(r.error) : callback();
            });
          });

          sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
            socket.emit('media:produce', { transportId: sendTransport.id, kind, rtpParameters, appData }, (r) => {
              r?.error ? errback(r.error) : callback({ id: r.producerId });
            });
          });

          // Produce audio
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            audioProducerRef.current = await sendTransport.produce({ track: audioTrack });
          }

          // Produce video
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoProducerRef.current = await sendTransport.produce({ track: videoTrack });
          }

          // Get existing producers in room
          socket.emit('media:getProducers', {}, (gRes) => {
            if (gRes?.producers) {
              gRes.producers.forEach(({ producerId, socketId, kind }) => {
                consumeProducer(socket, device, producerId, socketId);
              });
            }
          });
        });

        // Create recv transport
        socket.emit('media:createTransport', { direction: 'recv' }, async (tRes) => {
          if (tRes?.error) return console.error('createTransport (recv) error:', tRes.error);

          const recvTransport = device.createRecvTransport(tRes);
          recvTransportRef.current = recvTransport;

          recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socket.emit('media:connectTransport', { transportId: recvTransport.id, dtlsParameters }, (r) => {
              r?.error ? errback(r.error) : callback();
            });
          });
        });
      });
    } catch (err) {
      console.error('Mediasoup init error:', err);
    }
  }

  async function consumeProducer(socket, device, producerId, producerSocketId) {
    if (!device || !recvTransportRef.current) return;
    const { rtpCapabilities } = device;

    socket.emit('media:consume', { producerId, rtpCapabilities }, async (res) => {
      if (res?.error) return console.error('consume error:', res.error);

      const consumer = await recvTransportRef.current.consume({
        id: res.id,
        producerId: res.producerId,
        kind: res.kind,
        rtpParameters: res.rtpParameters,
      });

      consumersRef.current[producerId] = consumer;

      socket.emit('media:resumeConsumer', { consumerId: res.id }, () => {});

      setRemoteStreams((prev) => {
        const existing = prev[producerSocketId];
        let stream = existing?.stream || new MediaStream();
        stream.addTrack(consumer.track);
        return { ...prev, [producerSocketId]: { stream, displayName: existing?.displayName || 'Remote' } };
      });

      consumer.on('trackended', () => {
        setRemoteStreams((prev) => {
          const entry = prev[producerSocketId];
          if (!entry) return prev;
          entry.stream.removeTrack(consumer.track);
          return { ...prev };
        });
      });
    });
  }

  function setupSocketListeners(socket, stream) {
    socket.on('room:participantJoined', (data) => {
      toast(`${data.displayName} joined`, { icon: '👋' });
      setParticipants((p) => [...p, data]);
      setRemoteStreams((prev) => ({
        ...prev,
        [data.socketId]: { stream: new MediaStream(), displayName: data.displayName },
      }));
    });

    socket.on('room:participantLeft', ({ socketId, displayName: dn }) => {
      toast(`${dn || 'Participant'} disconnected`, { icon: '👋' });
      setParticipants((p) => p.filter((x) => x.socketId !== socketId));
      setRemoteStreams((prev) => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    socket.on('room:ended', ({ aiSummary: summary }) => {
      setCallStatus('ended');
      if (summary) setAiSummary(summary);
      toast('Call has ended', { icon: '📞' });
    });

    socket.on('chat:message', (msg) => {
      setMessages((m) => [...m, normalizeMsg(msg)]);
    });

    socket.on('media:newProducer', ({ producerId, socketId }) => {
      if (deviceRef.current) {
        consumeProducer(socket, deviceRef.current, producerId, socketId);
      }
    });

    socket.on('vision-result', (data) => {
      setVisionDetections((prev) => [data, ...prev].slice(0, 5));
      toast('AI detected brand/device info', { icon: '👁' });
    });

    socket.on('copilot-suggestion', (data) => {
      setCopilotSuggestions((prev) => [data, ...prev]);
      setActiveTab('copilot');
    });
  }

  function cleanup() {
    audioProducerRef.current?.close();
    videoProducerRef.current?.close();
    Object.values(consumersRef.current).forEach((c) => c.close());
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    localStream?.getTracks().forEach((t) => t.stop());
    disconnectCallSocket();
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  function toggleAudio() {
    const producer = audioProducerRef.current;
    if (!producer) return;
    if (audioMuted) {
      producer.resume();
      socketRef.current?.emit('media:resumeProducer', { producerId: producer.id });
    } else {
      producer.pause();
      socketRef.current?.emit('media:pauseProducer', { producerId: producer.id });
    }
    localStream?.getAudioTracks().forEach((t) => { t.enabled = audioMuted; });
    setAudioMuted(!audioMuted);
  }

  function toggleVideo() {
    const producer = videoProducerRef.current;
    if (!producer) return;
    if (videoOff) {
      producer.resume();
      socketRef.current?.emit('media:resumeProducer', { producerId: producer.id });
    } else {
      producer.pause();
      socketRef.current?.emit('media:pauseProducer', { producerId: producer.id });
    }
    localStream?.getVideoTracks().forEach((t) => { t.enabled = videoOff; });
    setVideoOff(!videoOff);
  }

  function handleEndCall() {
    if (role === 'agent') {
      socketRef.current?.emit('room:end', {}, () => {});
    } else {
      socketRef.current?.emit('room:leave');
    }
    cleanup();
    navigate('/dashboard');
  }

  function sendMessage() {
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chat:send', { message: chatInput.trim() });
    setChatInput('');
  }

  function normalizeMsg(m) {
    return {
      id: m.id,
      senderName: m.senderName || m.sender_name,
      senderRole: m.senderRole || m.sender_role,
      message: m.message,
      sentAt: m.sentAt || m.sent_at,
    };
  }

  // ── Render: Call Ended overlay ───────────────────────────────────────────────
  if (callStatus === 'ended') {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl animate-slide-up">
          <div className="bg-surface-800 border border-slate-700/50 rounded-2xl p-8 text-center mb-6">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-7 h-7 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Call Ended</h2>
            <p className="text-slate-400 text-sm">This support session has concluded.</p>
          </div>

          {aiSummary && <AISummaryCard summary={aiSummary} />}

          <div className="flex gap-3 mt-4 justify-center">
            <button onClick={() => navigate('/dashboard')} className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-xl text-white text-sm font-medium transition-colors">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div className="h-screen bg-surface-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="h-14 bg-surface-900 border-b border-slate-700/50 flex items-center px-5 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-brand-400" />
          <span className="font-semibold text-white text-sm">Videoy</span>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">
              {callStatus === 'connecting' ? 'Connecting…' : 'Live'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {role === 'agent' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-full">
              <Circle className="w-2 h-2 text-red-400 fill-red-400 animate-pulse" />
              <span className="text-xs text-red-400 font-medium">Recording</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Users className="w-3.5 h-3.5" />
            {participants.length + 1}
          </div>
          <span className="text-xs text-slate-600 px-2 py-1 bg-slate-800 rounded-lg capitalize">{role}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex-1 flex flex-col relative p-4 gap-3">
          {callStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-950/80 z-10 rounded-xl">
              <div className="text-center">
                <Loader className="w-10 h-10 text-brand-400 animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Setting up media…</p>
              </div>
            </div>
          )}

          {/* Remote videos */}
          <div className={`flex-1 grid gap-3 ${remoteEntries.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {remoteEntries.length === 0 ? (
              <div className="flex items-center justify-center rounded-2xl bg-surface-800 border border-dashed border-slate-700">
                <div className="text-center">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Waiting for participant…</p>
                </div>
              </div>
            ) : (
              remoteEntries.map(([socketId, { stream, displayName: dn }]) => (
                <RemoteVideo key={socketId} stream={stream} displayName={dn} />
              ))
            )}
          </div>

          {/* Local PiP */}
          <div className="absolute bottom-20 right-6 w-36 h-24 rounded-xl overflow-hidden border-2 border-slate-600 shadow-xl bg-surface-900">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {videoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-900">
                <VideoOff className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
              You
            </div>
          </div>

          {/* Control bar */}
          <div className="h-16 flex items-center justify-center gap-3 bg-surface-900 rounded-2xl border border-slate-700/50 px-6 flex-shrink-0">
            <ControlBtn
              id="mute-btn"
              onClick={toggleAudio}
              active={!audioMuted}
              icon={audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              label={audioMuted ? 'Unmute' : 'Mute'}
            />
            <ControlBtn
              id="video-btn"
              onClick={toggleVideo}
              active={!videoOff}
              icon={videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              label={videoOff ? 'Show Video' : 'Hide Video'}
            />
            <button
              id="chat-btn"
              onClick={() => setChatOpen(!chatOpen)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${chatOpen ? 'bg-brand-600/20 text-brand-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px] font-medium">Chat</span>
            </button>
            <button
              id="end-call-btn"
              onClick={handleEndCall}
              className="flex flex-col items-center gap-1 px-5 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded-xl transition-all ml-4"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="text-[10px] font-medium">{role === 'agent' ? 'End Call' : 'Leave'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar container */}
        <div className="w-[380px] flex flex-col bg-surface-900 border-l border-slate-700/50 flex-shrink-0">
          {/* Tabs header */}
          <div className="flex border-b border-slate-700/50 bg-surface-950/40">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'chat'
                  ? 'border-brand-500 text-brand-400 bg-surface-900/20'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            {role === 'agent' && (
              <button
                onClick={() => setActiveTab('copilot')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeTab === 'copilot'
                    ? 'border-brand-500 text-brand-400 bg-surface-900/20'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Copilot
              </button>
            )}
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'info'
                  ? 'border-brand-500 text-brand-400 bg-surface-900/20'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Info
            </button>
          </div>

          {/* Tab Content: CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-slate-600 text-xs mt-8">No messages yet</p>
                )}
                {messages.map((m, i) => (
                  <ChatBubble key={m.id || i} msg={m} isOwn={m.senderName === displayName} />
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-slate-700/50 bg-surface-950/20">
                <div className="flex gap-2">
                  <input
                    id="chat-input"
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message…"
                    className="flex-1 bg-surface-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                  <button
                    id="send-btn"
                    onClick={sendMessage}
                    disabled={!chatInput.trim()}
                    className="p-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl text-white transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: AI COPILOT */}
          {activeTab === 'copilot' && role === 'agent' && (
            <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-5">
              {/* Ask Copilot Box */}
              <div className="bg-surface-800/40 border border-slate-700/50 rounded-2xl p-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ask AI Copilot</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && askCopilot()}
                    placeholder="Ask Gemini about resolution..."
                    className="flex-1 bg-surface-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                  <button
                    onClick={askCopilot}
                    disabled={copilotAsking || !copilotInput.trim()}
                    className="px-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl text-white text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    {copilotAsking ? '…' : 'Ask'}
                  </button>
                </div>

                {/* Copilot responses */}
                {copilotSuggestions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {copilotSuggestions.map((s, idx) => (
                      <div key={idx} className="bg-surface-800 border border-slate-700/70 rounded-xl p-3 text-xs animate-slide-up">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="font-semibold text-brand-400">Gemini:</span>
                          <span className="text-[10px] text-slate-500">{new Date(s.timestamp).toLocaleTimeString()}</span>
                          {s.escalate && (
                            <span className="ml-auto bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Escalate</span>
                          )}
                        </div>
                        <p className="text-slate-300 leading-relaxed">{s.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Vision Detections */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
                  Live Vision AI (5s intervals)
                </h4>
                {visionDetections.length === 0 ? (
                  <div className="bg-surface-800/30 border border-dashed border-slate-700/60 rounded-2xl p-6 text-center text-xs text-slate-500">
                    Waiting for video frames from customer…
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visionDetections.map((det) => {
                      const scoreColor = det.confidence > 80
                        ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20'
                        : det.confidence > 50
                        ? 'text-amber-400 bg-amber-500/15 border-amber-500/20'
                        : 'text-red-400 bg-red-500/15 border-red-500/20';

                      return (
                        <div key={det.id} className="bg-surface-800 border border-slate-700/60 rounded-xl p-3 text-xs flex items-start justify-between gap-3 shadow-md transition-all hover:border-slate-600 animate-slide-up">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-200 truncate">{det.product || 'Unknown Product'}</p>
                            <p className="text-slate-400 mt-0.5 leading-relaxed">{det.issue || 'Analyzing feed…'}</p>
                            <p className="text-[9px] text-slate-600 mt-1">{new Date(det.detectedAt).toLocaleTimeString()}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${scoreColor}`}>
                            {det.confidence}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Content: SESSION INFO */}
          {activeTab === 'info' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-surface-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-2.5 text-xs text-slate-300">
                <div>
                  <p className="text-slate-500">Session ID</p>
                  <p className="font-mono text-slate-300 select-all">{sessionId}</p>
                </div>
                <div>
                  <p className="text-slate-500">Current Role</p>
                  <p className="capitalize font-semibold text-brand-400">{role}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Participants</h4>
                <div className="space-y-2">
                  {participants.map((p, idx) => (
                    <div key={idx} className="bg-surface-800/40 border border-slate-700/40 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-white">{p.displayName}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{p.role}</p>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Joined {new Date(p.joinedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RemoteVideo({ stream, displayName }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative rounded-2xl overflow-hidden bg-surface-800 border border-slate-700/50">
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-3 left-3 text-xs text-white bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
        {displayName}
      </div>
    </div>
  );
}

function ControlBtn({ onClick, active, icon, label, id }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
        active
          ? 'bg-slate-700 hover:bg-slate-600 text-white'
          : 'bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function ChatBubble({ msg, isOwn }) {
  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs font-medium text-slate-400">{msg.senderName}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded text-slate-500 ${
          msg.senderRole === 'agent' ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-700'
        }`}>{msg.senderRole}</span>
      </div>
      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
        isOwn
          ? 'bg-brand-600 text-white rounded-br-sm'
          : 'bg-surface-800 border border-slate-700 text-slate-200 rounded-bl-sm'
      }`}>
        {msg.message}
      </div>
      <span className="text-[10px] text-slate-600 mt-0.5">
        {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
      </span>
    </div>
  );
}

function AISummaryCard({ summary }) {
  const sentimentColor = {
    positive: 'text-emerald-400',
    neutral: 'text-amber-400',
    negative: 'text-red-400',
  }[summary.sentiment] || 'text-slate-400';

  return (
    <div className="bg-gradient-to-br from-brand-900/40 to-purple-900/20 border border-brand-700/40 rounded-2xl p-6 animate-slide-up">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-brand-600/30 rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-brand-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white text-sm">AI Post-Call Summary</h3>
          <p className="text-xs text-slate-400">Generated by Gemini</p>
        </div>
        <span className={`ml-auto text-xs font-semibold capitalize ${sentimentColor}`}>
          {summary.sentiment} ↑
        </span>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed mb-5">{summary.summary}</p>

      <div className="space-y-4">
        <SummarySection title="Issue Detected" content={summary.issue_detected} color="red" />
        <SummarySection title="Resolution Steps" items={summary.resolution_steps} color="blue" />
        <SummarySection title="Action Items" items={summary.action_items} color="amber" />
      </div>
    </div>
  );
}

function SummarySection({ title, content, items, color }) {
  const colors = {
    red:   'bg-red-500/10 border-red-500/30 text-red-300',
    blue:  'bg-brand-500/10 border-brand-500/30 text-brand-300',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  };
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      <div className={`border rounded-xl p-3 text-sm ${colors[color]}`}>
        {content && <p>{content}</p>}
        {items && items.length > 0 && (
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        )}
        {items && items.length === 0 && <p className="text-slate-500 italic">None</p>}
      </div>
    </div>
  );
}
