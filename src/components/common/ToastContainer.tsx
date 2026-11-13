import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';
import { toast, ToastMessage, ConfirmOptions } from '../../services/toastService';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeConfirm, setActiveConfirm] = useState<{
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Typed safeguard state for destructive operations
  const [typedInput, setTypedInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubToasts = toast.subscribeToasts((currentToasts) => {
      setToasts(currentToasts);
    });

    const unsubConfirm = toast.subscribeConfirm((options, resolve) => {
      if (options && resolve) {
        setActiveConfirm({ options, resolve });
        setTypedInput('');
      } else {
        setActiveConfirm(null);
        setTypedInput('');
      }
    });

    return () => {
      unsubToasts();
      unsubConfirm();
    };
  }, []);

  // Keyboard navigation for confirm dialog
  useEffect(() => {
    if (!activeConfirm) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelConfirm();
      } else if (e.key === 'Enter') {
        const reqKey = activeConfirm.options.typedKeyword;
        if (!reqKey || typedInput.trim().toUpperCase() === reqKey.trim().toUpperCase()) {
          e.preventDefault();
          handleAcceptConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeConfirm, typedInput]);

  // Auto-focus input when typedKeyword is requested
  useEffect(() => {
    if (activeConfirm?.options.typedKeyword && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activeConfirm]);

  const handleAcceptConfirm = () => {
    if (activeConfirm) {
      activeConfirm.resolve(true);
      setActiveConfirm(null);
      setTypedInput('');
    }
  };

  const handleCancelConfirm = () => {
    if (activeConfirm) {
      activeConfirm.resolve(false);
      setActiveConfirm(null);
      setTypedInput('');
    }
  };

  return (
    <>
      {/* 1. TOAST NOTIFICATIONS STACK */}
      <aside
        aria-label="Notification Center"
        className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto shadow-2xl rounded-sm border p-3 flex items-start space-x-3 transition-all duration-200 transform translate-y-0 opacity-100 ${
                isSuccess
                  ? 'bg-emerald-950/95 border-emerald-600 text-emerald-100'
                  : isError
                  ? 'bg-rose-950/95 border-rose-600 text-rose-100'
                  : isWarning
                  ? 'bg-amber-950/95 border-amber-600 text-amber-100'
                  : 'bg-slate-900/95 border-slate-700 text-slate-100'
              }`}
              style={{
                animation: 'toastSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
              }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {isError && <XCircle className="w-4 h-4 text-rose-400" />}
                {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-sky-400" />}
              </div>

              <div className="flex-1 text-xs">
                {t.title && <div className="font-extrabold uppercase tracking-wide mb-0.5">{t.title}</div>}
                <div className="font-medium whitespace-pre-line leading-relaxed">{t.message}</div>

                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      toast.dismiss(t.id);
                    }}
                    className="mt-2 px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-sm font-bold text-[11px] flex items-center space-x-1 transition-colors"
                  >
                    <span>{t.action.label}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </aside>

      {/* 2. STYLED CONFIRMATION / SAFEGUARD MODAL */}
      {activeConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ animation: 'backdropFadeIn 150ms ease-out forwards' }}
        >
          <div
            className={`bg-white dark:bg-slate-900 border-2 w-full max-w-md rounded-sm shadow-2xl overflow-hidden flex flex-col ${
              activeConfirm.options.isDestructive
                ? 'border-rose-600'
                : 'border-sky-600'
            }`}
            style={{ animation: 'modalPopIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            {/* Header */}
            <div
              className={`p-4 flex items-center space-x-3 border-b ${
                activeConfirm.options.isDestructive
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div
                className={`p-2 rounded-sm ${
                  activeConfirm.options.isDestructive
                    ? 'bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-200'
                    : 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-200'
                }`}
              >
                {activeConfirm.options.isDestructive ? (
                  <AlertOctagon className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                  {activeConfirm.options.title}
                </h3>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p className="whitespace-pre-line leading-relaxed font-medium">
                {activeConfirm.options.message}
              </p>

              {/* Typed Keyword Safeguard */}
              {activeConfirm.options.typedKeyword && (
                <div className="pt-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    To confirm, please type{' '}
                    <span className="font-mono text-rose-600 dark:text-rose-400 font-black uppercase">
                      {activeConfirm.options.typedKeyword}
                    </span>{' '}
                    below:
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={typedInput}
                    onChange={(e) => setTypedInput(e.target.value)}
                    placeholder={`Type ${activeConfirm.options.typedKeyword}`}
                    className="w-full px-3 py-1.5 font-mono text-xs uppercase font-bold border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-sm focus:border-rose-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2">
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-sm transition-colors"
              >
                {activeConfirm.options.cancelText || 'Cancel [Esc]'}
              </button>

              <button
                type="button"
                onClick={handleAcceptConfirm}
                disabled={
                  Boolean(activeConfirm.options.typedKeyword) &&
                  typedInput.trim().toUpperCase() !== activeConfirm.options.typedKeyword?.trim().toUpperCase()
                }
                className={`px-4 py-1.5 text-white text-xs font-black rounded-sm shadow-sm transition-colors ${
                  activeConfirm.options.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed'
                    : 'bg-sky-600 hover:bg-sky-500'
                }`}
              >
                {activeConfirm.options.confirmText || 'Confirm Action [Enter]'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
