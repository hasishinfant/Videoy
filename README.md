# SupportVision — AI-Powered Video Support Platform

> AtomQuest 1.0 Hackathon Project

SupportVision is a real-time, server-routed video support platform where agents create sessions and customers join via shareable links — no app install required. All media flows through a **Mediasoup SFU** (never peer-to-peer). When a call ends, Gemini AI auto-generates a post-call summary.

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment

Edit `server/.env`:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
JWT_SECRET=change_this_in_production
ANNOUNCED_IP=127.0.0.1   # Change to your LAN IP for cross-device testing
```

### 3. Seed Demo Accounts

```bash
cd server
node scripts/seed.js
```

### 4. Run Development Servers

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# → Server running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# → Client running on http://localhost:5173
```

### 5. Open in Browser

Navigate to: **http://localhost:5173**

---

## 🧪 Demo Flows

### Agent Flow
1. Go to `http://localhost:5173/agent-login`
2. Login with: `agent@demo.com` / `demo1234`
3. Click **New Session** → copy the invite link
4. Share the invite link with customer (paste in another browser tab/incognito window)
5. Click **Join Now** to enter the call
6. Use toolbar to mute/unmute, toggle video
7. Chat in the right panel
8. Click **End Call** → AI summary is generated automatically

### Customer Flow
1. Open the invite link in a new tab/incognito window
2. Enter your name → click **Join Now**
3. Video and audio start automatically
4. Chat with the agent
5. When agent ends call, session summary is shown

### Admin Flow
1. Login with: `admin@demo.com` / `admin1234`
2. You're redirected to `/admin` — live session monitor
3. See active sessions with participant count and live duration
4. Click **End Session** to force-end any session

---

## 📁 Project Structure

```
SupportVision/
├── server/                  # Node.js + Express + Socket.io backend
│   ├── config/              # DB init, Mediasoup config
│   ├── controllers/         # Route handlers
│   ├── middleware/          # JWT auth, error handler
│   ├── models/              # SQLite queries
│   ├── routes/              # Express routers
│   ├── scripts/             # Seed script
│   ├── services/            # Mediasoup, Gemini, session lifecycle
│   ├── socket/              # Socket.io handlers
│   └── utils/               # Logger, invite token
│
├── client/                  # React + Vite + TailwindCSS frontend
│   └── src/
│       ├── api/             # Axios API modules
│       ├── context/         # Auth context
│       ├── pages/           # AgentLogin, Dashboard, CallRoom, Admin, Summary
│       ├── components/      # Shared UI components
│       └── socket/          # Socket.io client
│
└── docs/
    └── architecture.md      # Technical architecture details
```

---

## 🔌 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | Public | Agent login |
| POST | `/api/auth/register` | Admin only | Create agent |
| GET | `/api/auth/me` | Agent | Current user |
| POST | `/api/sessions` | Agent | Create session |
| GET | `/api/sessions` | Agent | List own sessions |
| GET | `/api/sessions/:token` | Public | Validate invite |
| PATCH | `/api/sessions/:token/end` | Agent | End session |
| GET | `/api/sessions/:token/summary` | Agent | Get AI summary |
| GET | `/api/admin/sessions/live` | Admin | Live sessions |
| PATCH | `/api/admin/sessions/:token/end` | Admin | Force end |
| GET | `/api/admin/stats` | Admin | Stats |

---

## ⚠️ Known Limitations

1. **Single worker** — Mediasoup is configured with a single worker. For production, spawn one per CPU core.
2. **Local IP required** — For cross-device testing on LAN, set `ANNOUNCED_IP` in `.env` to your machine's LAN IP (e.g., `192.168.1.X`).
3. **TURN server** — Not configured. Video may fail through strict NAT/firewalls. Works reliably on same network.
4. **SQLite** — Not suitable for horizontal scaling. Use PostgreSQL for production.
5. **Recording** — The "Recording" pill is UI-only. Actual recording via FFmpeg piping is not wired (planned).
6. **Gemini key** — AI summaries require a valid `GEMINI_API_KEY`. If absent, sessions still end cleanly with a null summary.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, Socket.io |
| Media Server | Mediasoup 3 (SFU) |
| Database | SQLite + better-sqlite3 |
| Auth | JWT (jsonwebtoken) |
| AI | @google/generative-ai (Gemini Flash) |
| Frontend | React, Vite |
| Styling | TailwindCSS v4 |
| Icons | Lucide React |

---

Built for **AtomQuest 1.0** · 2026
