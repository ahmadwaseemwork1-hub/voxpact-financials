import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth, type Permission } from '../../store/AuthProvider';
import { Button } from '../ui/Button';
import { Logo } from './Logo';

export function FullPageLoader({ label = 'Loading your portal…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5">
      <Logo />
      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 animate-[shimmer_1.4s_linear_infinite] rounded-full bg-gold-gradient" />
      </div>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

export function ProtectedRoute({ permission }: { permission?: Permission }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  if (permission && !can(permission)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/12 text-danger">
          <ShieldAlert className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <h1 className="mt-5 text-lg font-semibold text-ink">Restricted area</h1>
        <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
          Your account doesn't have access to this section. Speak to an administrator if you believe this is a mistake.
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return <Outlet />;
}
