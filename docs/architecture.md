# SupportVision — Technical Architecture

## Overview

SupportVision uses a **Selective Forwarding Unit (SFU)** architecture powered by Mediasoup. Unlike peer-to-peer WebRTC where media flows directly between browsers, all media passes through our server — making it inspectable, recordable, and scalable.

---

## Why Mediasoup? (SFU vs. P2P)

### Peer-to-Peer (what we did NOT use)
```
Browser A ──────────────────── Browser B
         (direct media stream)
```
Problems: No server-side visibility, cannot record, fails through strict NAT, doesn't scale.

### SFU — Server Forwarding Unit (what we use)
```
Browser A ──── send ──→ Mediasoup Router ──── forward ──→ Browser B
Browser A ←── recv ──── Mediasoup Router ←──── send ───── Browser B
```
Benefits:
- Server sees all media → can record, transcode, relay
- Satisfies "media routed through OUR server" requirement
- Scales to N participants: each publishes once, server distributes

---

## Mediasoup Concepts Used

| Concept | Role |
|---------|------|
| **Worker** | OS process managing RTP. One per CPU core. |
| **Router** | Isolated media graph per session. Holds codecs. |
| **WebRtcTransport** | DTLS/ICE tunnel between browser and server. |
| **Producer** | Browser's outgoing stream (audio OR video track). |
| **Consumer** | Server-side track forwarded to another peer. |

### Per-Session State
```
Session Token → {
  router:  Mediasoup.Router
  peers: {
    [socketId]: {
      sendTransport: WebRtcTransport   (browser → server)
      recvTransport: WebRtcTransport   (server → browser)
      producers: Map<id, Producer>     (tracks I'm sending)
      consumers: Map<id, Consumer>     (tracks I'm receiving)
    }
  }
}
```

---

## Socket.io Signaling Flow

The WebRTC handshake requires a "signaling" channel to exchange SDP/ICE info. We use Socket.io for this.

### Full Join Sequence (New Participant)

```
Browser                                    Server (Socket.io + Mediasoup)
  │                                              │
  ├─── room:join { sessionToken, displayName } ──→│
  │←─────────── { participants, chatHistory } ───┤  (joins socket room)
  │                                              │
  ├─── media:getRouterCapabilities ─────────────→│
  │←──────────── { rtpCapabilities } ────────────┤  (codecs supported)
  │                                              │
  ├─── media:createTransport { send } ──────────→│  (creates WebRtcTransport)
  │←─── { id, iceParams, iceCandidates, dtls } ──┤
  │  [ICE gathering happens]                     │
  ├─── media:connectTransport { dtlsParameters } →│  (DTLS handshake)
  │←───────────── { success } ───────────────────┤
  │                                              │
  ├─── media:produce { kind, rtpParameters } ───→│  (start sending audio/video)
  │←──────────── { producerId } ─────────────────┤
  │                                              │  → Server emits media:newProducer
  │                                              │     to all other peers in room
  ├─── media:createTransport { recv } ──────────→│
  │←─── { id, iceParams, iceCandidates, dtls } ──┤
  ├─── media:connectTransport ──────────────────→│
  ├─── media:consume { producerId } ────────────→│  (subscribe to remote stream)
  │←─────── { consumerId, rtpParameters } ───────┤
  ├─── media:resumeConsumer { consumerId } ──────→│  (start playback)
  │   [Video appears in <video> element]         │
```

---

## Session Lifecycle State Machine

```
[Agent creates session]
        │
        ▼
   status: "waiting"
   (invite link generated)
        │
        │ [first participant joins]
        ▼
   status: "active"
   (started_at recorded)
        │
        │ [agent calls room:end OR agent disconnects]
        ▼
   status: "ended"
   (ended_at + duration_secs recorded)
        │
        ▼
   [Gemini summary generated]
        │
        ▼
   ai_summary stored in DB
```

---

## AI Summary Pipeline

```
1. room:end event received (or HTTP PATCH /api/sessions/:token/end)
         │
         ▼
2. session.service.endSession(token)
   → sessionModel.markEnded(token)       writes ended_at, duration_secs
         │
         ▼
3. chatModel.findBySession(session.id)   fetches all chat messages
         │
         ▼
4. gemini.service.generatePostCallSummary(messages, duration)
   → builds prompt with transcript
   → calls gemini-1.5-flash API
   → parses JSON response
         │
         ▼
5. sessionModel.saveSummary(token, JSON.stringify(summary))
         │
         ▼
6. broadcastFn({ reason, aiSummary })    emits room:ended to all sockets
         │
         ▼
7. mediasoup.closeRoom(token)            tears down router + transports
```

### Gemini Prompt Design
The prompt instructs Gemini to return **strict JSON only** (no markdown wrappers) with keys:
- `issue_detected` — natural language description of the problem
- `resolution_steps` — ordered array of steps taken
- `action_items` — follow-up tasks
- `sentiment` — positive | neutral | negative
- `summary` — 2–3 sentence narrative

Graceful degradation: if Gemini fails or API key is absent, the session still ends cleanly and `ai_summary` is stored as `null`.

---

## Auth Architecture

### Agent Auth (long-lived JWT)
```
POST /api/auth/login
→ verifies bcrypt password hash
→ returns signed JWT { sub, email, name, role, iat, exp }

JWT stored in localStorage
Sent as: Authorization: Bearer <token>
Socket handshake: auth.token = <token>
```

### Customer Auth (invite JWT, stateless)
```
POST /api/sessions → agent gets inviteJWT
Invite URL: /join/{sessionToken}?t={inviteJWT}

inviteJWT payload: { sessionToken, role: "customer", exp: 24h }
Customer socket handshake: auth.inviteToken = <inviteJWT>

Server decodes → verifies sessionToken matches → allows join
Customers cannot access REST agent/admin endpoints (no agent JWT)
```

---

## Database Schema

```sql
agents        → id, name, email, password_hash, role, created_at
sessions      → id, session_token, created_by, status, started_at, ended_at, duration_secs, ai_summary
participants  → id, session_id, display_name, role, socket_id, joined_at, left_at
chat_messages → id, session_id, sender_name, sender_role, message, sent_at
```

Indexes on: `sessions.session_token`, `sessions.status`, `participants.session_id`, `chat_messages.session_id`
