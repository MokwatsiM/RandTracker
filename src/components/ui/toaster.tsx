'use client';

import { X } from 'lucide-react';
import { useToastStore } from '@/stores/toastStore';

/** Short messages at the bottom of the screen, such as "Deleted" with an Undo button. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2 md:bottom-6" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="flex items-center gap-3 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              className="font-semibold underline underline-offset-2"
              onClick={() => {
                dismiss(toast.id);
                void toast.action!.run();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
