import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Page not found');
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[60vh] flex-col items-center justify-center text-center"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <Compass className="h-7 w-7" strokeWidth={1.6} />
      </span>
      <p className="mt-6 font-display text-5xl font-bold gold-text">404</p>
      <h1 className="mt-2 text-lg font-semibold text-ink">This page doesn't exist</h1>
      <p className="mt-1.5 max-w-sm text-sm text-ink-muted">
        The link may be outdated, or the section may not be available to your role.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Go back
        </Button>
        <Button onClick={() => navigate('/')}>Back to dashboard</Button>
      </div>
    </motion.div>
  );
}
