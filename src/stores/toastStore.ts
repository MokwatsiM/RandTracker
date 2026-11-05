import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void | Promise<void> };
}

interface ToastStore {
  toasts: Toast[];
  /** Shows a message for 8 seconds, optionally with a button such as Undo. */
  show: (message: string, action?: Toast['action']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, action) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, action }] }));
    setTimeout(() => get().dismiss(id), 8000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
