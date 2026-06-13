import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AgentLogin from './pages/AgentLogin';
import AgentDashboard from './pages/AgentDashboard';
import JoinPage from './pages/JoinPage';
import CallRoom from './pages/CallRoom';
import AdminDashboard from './pages/AdminDashboard';
import SessionSummary from './pages/SessionSummary';
import PrivateRoute from './components/PrivateRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Navigate to="/agent-login" replace />} />
          <Route path="/agent-login" element={<AgentLogin />} />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route
            path="/dashboard"
            element={<PrivateRoute roles={['agent', 'admin']}><AgentDashboard /></PrivateRoute>}
          />
          <Route path="/call/:sessionId" element={<CallRoom />} />
          <Route
            path="/admin"
            element={<PrivateRoute roles={['admin']}><AdminDashboard /></PrivateRoute>}
          />
          <Route
            path="/sessions/:token/summary"
            element={<PrivateRoute roles={['agent', 'admin']}><SessionSummary /></PrivateRoute>}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
