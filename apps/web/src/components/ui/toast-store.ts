import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'attention';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const AUTO_DISMISS_MS = 6000;
let nextId = 1;

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, tone = 'info') => {
    const id = nextId++;
    // Keep at most 3 on screen
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Show a short notification, e.g. toast('Order #A1B2C3 is ready to collect', 'success'). */
export function toast(message: string, tone: ToastTone = 'info') {
  useToastStore.getState().show(message, tone);
}
