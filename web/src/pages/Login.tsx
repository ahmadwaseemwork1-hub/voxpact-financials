import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, ShieldCheck, TrendingUp, User as UserIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../store/AuthProvider';
import { useToast } from '../store/ToastProvider';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { Logo } from '../components/layout/Logo';
import { ChangePasswordModal } from './Settings';

export default function Login() {
  useDocumentTitle('Sign in');
  const { user, login, loading, logoutReason, clearLogoutReason } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forceChange, setForceChange] = useState(false);

  useEffect(() => {
    if (logoutReason) {
      setError(logoutReason);
      clearLogoutReason();
    }
  }, [logoutReason, clearLogoutReason]);

  if (!loading && user && !forceChange) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter your username and password');
      return;
    }
    setBusy(true);
    try {
      const signedIn = await login(username.trim(), password);
      if (signedIn.mustChangePassword) {
        setForceChange(true);
        toast.warning('Password change required', 'Set a new password before continuing.');
      } else {
        toast.success(`Welcome back, ${signedIn.fullName || signedIn.username}`);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-accent/[0.08] blur-[120px]" />
        <div className="absolute -bottom-52 -right-32 h-[560px] w-[560px] rounded-full bg-navy-500/25 blur-[130px]" />
      </div>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden flex-col justify-between bg-navy-gradient p-10 lg:flex"
        >
          <Logo />
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
              Every rupee, <span className="gold-text">accounted for.</span>
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-navy-200">
              Expenses, revenue, partner distribution and payroll for Voxpact — in one controlled, auditable place.
            </p>
            <ul className="mt-8 space-y-3.5">
              {[
                { icon: TrendingUp, text: 'Live profit, cash position and budget health' },
                { icon: ShieldCheck, text: 'Role-based access with a full audit trail' },
                { icon: Lock, text: 'Hashed credentials, JWT sessions, auto-logout' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3 text-sm text-navy-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.07] text-accent">
                    <item.icon className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[0.7rem] text-navy-300">© {new Date().getFullYear()} Voxpact · Lahore, Pakistan</p>
        </motion.div>

        {/* Form panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="glass flex flex-col justify-center rounded-3xl p-8 sm:p-10 lg:rounded-l-none"
        >
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h2 className="font-display text-xl font-bold tracking-tight text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">Use the credentials issued to you by an administrator.</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/[0.08] px-3.5 py-3"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <p className="text-xs leading-relaxed text-danger">{error}</p>
            </motion.div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Username" htmlFor="login-user">
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <Input
                  id="login-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  autoComplete="username"
                  placeholder="your.username"
                  autoFocus
                />
              </div>
            </Field>

            <Field label="Password" htmlFor="login-pass">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <Input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-subtle transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" fullWidth loading={busy}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-ink-subtle">
            Sessions expire after 24 hours and lock automatically after 30 minutes of inactivity.
            <br />
            Failed sign-in attempts are rate limited and logged.
          </p>
        </motion.div>
      </div>

      <ChangePasswordModal
        open={forceChange}
        forced
        onClose={() => {
          setForceChange(false);
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}
