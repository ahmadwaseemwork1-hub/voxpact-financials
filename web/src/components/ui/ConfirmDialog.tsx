import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown> | unknown;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={handle} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            destructive ? 'bg-danger/14 text-danger' : 'bg-accent/14 text-accent'
          }`}
        >
          <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="pt-0.5 text-sm leading-relaxed text-ink-muted">{message}</div>
      </div>
    </Modal>
  );
}

/** Small hook so pages can trigger a confirm without wiring state each time. */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    message: ReactNode;
    title?: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => Promise<unknown> | unknown;
  }>({ open: false, message: '', onConfirm: () => undefined });

  const confirm = (options: {
    message: ReactNode;
    title?: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => Promise<unknown> | unknown;
  }) => setState({ ...options, open: true });

  const close = () => setState((s) => ({ ...s, open: false }));

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onClose={close}
      onConfirm={state.onConfirm}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      destructive={state.destructive ?? true}
    />
  );

  return { confirm, dialog };
}
