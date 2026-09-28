import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, apiError, getToken, setToken, UNAUTHORIZED_EVENT } from '../lib/api';
import { setCurrency } from '../lib/format';
import type { Role, User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  inactivityMinutes: number;
  login: (username: string, password: string) => Promise<User>;
  logout: (reason?: string) => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
  /** Role helpers */
  isHost: boolean;
  isAdmin: boolean;
  isManager: boolean;
  can: (permission: Permission) => boolean;
  logoutReason: string | null;
  clearLogoutReason: () => void;
}

export type Permission =
  | 'view:dashboard'
  | 'manage:expenses'
  | 'manage:recurring'
  | 'view:revenue'
  | 'manage:revenue'
  | 'view:partners'
  | 'view:employees'
  | 'manage:budget'
  | 'view:reports'
  | 'manage:users'
  | 'manage:admins'
  | 'view:audit';

const MATRIX: Record<Permission, Role[]> = {
  'view:dashboard': ['HOST', 'ADMIN', 'USER'],
  'manage:expenses': ['HOST', 'ADMIN', 'USER'],
  'manage:recurring': ['HOST', 'ADMIN'],
  'view:revenue': ['HOST', 'ADMIN', 'USER'],
  'manage:revenue': ['HOST', 'ADMIN'],
  'view:partners': ['HOST', 'ADMIN'],
  'view:employees': ['HOST', 'ADMIN'],
  'manage:budget': ['HOST', 'ADMIN'],
  'view:reports': ['HOST', 'ADMIN'],
  'manage:users': ['HOST', 'ADMIN'],
  'manage:admins': ['HOST'],
  'view:audit': ['HOST', 'ADMIN'],
};

const AuthContext = createContext<AuthContextValue | null>(null);

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown', 'visibilitychange'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [inactivityMinutes, setInactivityMinutes] = useState(30);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);
  const lastActivity = useRef<number>(Date.now());

  const clearSession = useCallback((reason?: string) => {
    setToken(null);
    setUserState(null);
    if (reason) setLogoutReason(reason);
  }, []);

  const logout = useCallback(
    async (reason?: string) => {
      try {
        if (getToken()) await api.post('/auth/logout');
      } catch {
        /* best effort */
      }
      clearSession(reason);
    },
    [clearSession],
  );

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUserState(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<{ user: User; inactivityTimeoutMinutes: number }>('/auth/me');
      setUserState(data.user);
      setInactivityMinutes(data.inactivityTimeoutMinutes ?? 30);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const { data } = await api.post<{ token: string; user: User; inactivityTimeoutMinutes: number }>('/auth/login', {
        username,
        password,
      });
      setToken(data.token);
      setUserState(data.user);
      setInactivityMinutes(data.inactivityTimeoutMinutes ?? 30);
      setLogoutReason(null);
      lastActivity.current = Date.now();
      return data.user;
    } catch (error) {
      throw new Error(apiError(error, 'Sign in failed'));
    }
  }, []);

  // Bootstrap: session + currency
  useEffect(() => {
    void refresh();
    api
      .get<{ settings: { currency?: string } }>('/settings')
      .then(({ data }) => setCurrency(data.settings?.currency ?? 'USD'))
      .catch(() => undefined);
  }, [refresh]);

  // Global 401 -> sign out
  useEffect(() => {
    const handler = () => clearSession('Your session expired. Please sign in again.');
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [clearSession]);

  // Auto-logout after N minutes of inactivity
  useEffect(() => {
    if (!user) return;
    const mark = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, mark, { passive: true }));

    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs >= inactivityMinutes * 60_000) {
        void logout(`Signed out after ${inactivityMinutes} minutes of inactivity.`);
      }
    }, 15_000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, mark));
      window.clearInterval(interval);
    };
  }, [user, inactivityMinutes, logout]);

  const can = useCallback(
    (permission: Permission) => (user ? MATRIX[permission].includes(user.role) : false),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      inactivityMinutes,
      login,
      logout,
      refresh,
      setUser: setUserState,
      isHost: user?.role === 'HOST',
      isAdmin: user?.role === 'ADMIN',
      isManager: user?.role === 'HOST' || user?.role === 'ADMIN',
      can,
      logoutReason,
      clearLogoutReason: () => setLogoutReason(null),
    }),
    [user, loading, inactivityMinutes, login, logout, refresh, can, logoutReason],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
