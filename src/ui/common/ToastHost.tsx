import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useEditorStore, type ToastKind } from '../../store/useEditorStore';

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

export function ToastHost() {
  const toasts = useEditorStore((s) => s.toasts);
  const dismiss = useEditorStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div key={toast.id} className={`toast toast-${toast.kind}`}>
            <Icon size={15} aria-hidden />
            <span>{toast.message}</span>
            <button type="button" className="icon-btn" title="閉じる" aria-label="閉じる" onClick={() => dismiss(toast.id)}>
              <X size={13} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
