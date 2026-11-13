// Reactive Toast & Confirmation System for Radha Drugs ERP
// Replaces blocking window.alert() and window.confirm() with non-blocking, accessible micro-interactions

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: ToastAction;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  typedKeyword?: string; // If set, user must type this exact keyword before confirming
}

type ToastListener = (toasts: ToastMessage[]) => void;
type ConfirmListener = (options: ConfirmOptions | null, resolve?: (val: boolean) => void) => void;

class ToastService {
  private toasts: ToastMessage[] = [];
  private toastListeners: ToastListener[] = [];
  private confirmListener: ConfirmListener | null = null;

  subscribeToasts(listener: ToastListener) {
    this.toastListeners.push(listener);
    listener([...this.toasts]);
    return () => {
      this.toastListeners = this.toastListeners.filter((l) => l !== listener);
    };
  }

  subscribeConfirm(listener: ConfirmListener) {
    this.confirmListener = listener;
    return () => {
      if (this.confirmListener === listener) {
        this.confirmListener = null;
      }
    };
  }

  private notifyToasts() {
    for (const listener of this.toastListeners) {
      listener([...this.toasts]);
    }
  }

  show(type: ToastType, message: string, options?: { title?: string; duration?: number; action?: ToastAction }) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const toast: ToastMessage = {
      id,
      type,
      message,
      title: options?.title,
      duration: options?.duration ?? (type === 'error' ? 5000 : 3500),
      action: options?.action,
    };

    this.toasts.push(toast);
    this.notifyToasts();

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, toast.duration);
    }

    return id;
  }

  success(message: string, options?: { title?: string; duration?: number; action?: ToastAction }) {
    return this.show('success', message, options);
  }

  error(message: string, options?: { title?: string; duration?: number; action?: ToastAction }) {
    return this.show('error', message, options);
  }

  warning(message: string, options?: { title?: string; duration?: number; action?: ToastAction }) {
    return this.show('warning', message, options);
  }

  info(message: string, options?: { title?: string; duration?: number; action?: ToastAction }) {
    return this.show('info', message, options);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notifyToasts();
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (!this.confirmListener) {
        // Fallback if component not mounted
        const ok = window.confirm(`${options.title}\n\n${options.message}`);
        resolve(ok);
        return;
      }
      this.confirmListener(options, resolve);
    });
  }
}

export const toast = new ToastService();
