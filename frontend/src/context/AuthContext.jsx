import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import { getSocket } from '../socket';

const AuthContext = createContext(null);

const TOKEN_KEY = 'settleup_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session
  const [error, setError] = useState(null);

  // On first load, if a token is already stored, try to resolve who it belongs
  // to so a page refresh doesn't kick the user back to login unnecessarily.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    setError(null);
    try {
      const { user, token } = await authApi.login(credentials);
      localStorage.setItem(TOKEN_KEY, token);
      setUser(user);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
      return false;
    }
  }

  async function signup(details) {
    setError(null);
    try {
      const { user, token } = await authApi.signup(details);
      localStorage.setItem(TOKEN_KEY, token);
      setUser(user);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed.');
      return false;
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    getSocket().disconnect();
  }

  const value = { user, loading, error, login, signup, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
