import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('sv_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('sv_agent_token'));

  function signIn(tokenStr, userData) {
    localStorage.setItem('sv_agent_token', tokenStr);
    localStorage.setItem('sv_user', JSON.stringify(userData));
    setToken(tokenStr);
    setUser(userData);
  }

  function signOut() {
    localStorage.removeItem('sv_agent_token');
    localStorage.removeItem('sv_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
