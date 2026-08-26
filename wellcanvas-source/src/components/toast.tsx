"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "information" | "warning" | "error";

type ToastOptions = {
  actionLabel?: string;
  durationMs?: number;
  message: string;
  onAction?: () => void;
  type?: ToastType;
};

type ToastRecord = Required<Pick<ToastOptions, "message" | "type">> &
  Pick<ToastOptions, "actionLabel" | "onAction"> & {
    durationMs: number;
    id: string;
  };

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toastIcon(type: ToastType) {
  if (type === "error") return "!";
  if (type === "warning") return "!";
  if (type === "information") return "i";
  return "✓";
}

function toastTone(type: ToastType) {
  if (type === "error") return "border-red-200 text-red-900";
  if (type === "warning") return "border-amber-200 text-amber-950";
  if (type === "information") return "border-sky-200 text-sky-950";
  return "border-emerald-200 text-stone-950";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastRecord | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const lastToastRef = useRef<{ at: number; message: string } | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current);
    hideTimerRef.current = null;
    removeTimerRef.current = null;
  }, []);

  const dismissToast = useCallback(() => {
    clearTimers();
    setVisible(false);
    removeTimerRef.current = window.setTimeout(() => setToast(null), 220);
  }, [clearTimers]);

  const scheduleDismiss = useCallback(
    (record: ToastRecord) => {
      clearTimers();
      if (record.durationMs <= 0) return;
      hideTimerRef.current = window.setTimeout(() => {
        if (pausedRef.current) {
          return;
        }
        dismissToast();
      }, record.durationMs);
    },
    [clearTimers, dismissToast],
  );

  const showToast = useCallback(
    ({
      actionLabel,
      durationMs,
      message,
      onAction,
      type = "success",
    }: ToastOptions) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const now = Date.now();
      if (
        lastToastRef.current?.message === trimmed &&
        now - lastToastRef.current.at < 700
      ) {
        return;
      }
      lastToastRef.current = { at: now, message: trimmed };

      const record: ToastRecord = {
        actionLabel,
        durationMs:
          durationMs ??
          (type === "error" || type === "warning" ? 6000 : onAction ? 5000 : 3500),
        id: `toast-${now}`,
        message: trimmed,
        onAction,
        type,
      };

      clearTimers();
      setToast(record);
      window.requestAnimationFrame(() => setVisible(true));
      scheduleDismiss(record);
    },
    [clearTimers, scheduleDismiss],
  );

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live={toast?.type === "error" ? "assertive" : "polite"}
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+1rem)] z-[70] flex justify-center px-4"
      >
        {toast && (
          <div
            className={`pointer-events-auto flex max-w-[min(40rem,calc(100vw-2rem))] items-center gap-3 rounded-xl border bg-white/90 px-4 py-3 text-sm shadow-lg backdrop-blur-md transition-opacity duration-200 motion-reduce:transition-none ${
              visible ? "opacity-100" : "opacity-0"
            } ${toastTone(toast.type)}`}
            onBlur={() => {
              pausedRef.current = false;
              scheduleDismiss(toast);
            }}
            onFocus={() => {
              pausedRef.current = true;
              clearTimers();
            }}
            onMouseEnter={() => {
              pausedRef.current = true;
              clearTimers();
            }}
            onMouseLeave={() => {
              pausedRef.current = false;
              scheduleDismiss(toast);
            }}
          >
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]"
            >
              {toastIcon(toast.type)}
            </span>
            <p className="min-w-0 flex-1 font-medium">{toast.message}</p>
            {toast.actionLabel && toast.onAction && (
              <button
                className="shrink-0 rounded-md px-2 py-1 text-sm font-bold text-[var(--accent)] underline underline-offset-4"
                onClick={() => {
                  toast.onAction?.();
                  dismissToast();
                }}
                type="button"
              >
                {toast.actionLabel}
              </button>
            )}
            {(toast.type === "error" || toast.type === "warning") && (
              <button
                aria-label="Close notification"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-300 text-base leading-none text-stone-600"
                onClick={dismissToast}
                type="button"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return context;
}

export function ToastBridge({
  actionLabel,
  message,
  onAction,
  type = "success",
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  type?: ToastType;
}) {
  const { showToast } = useToast();
  const actionRef = useRef(onAction);
  const hasAction = Boolean(onAction);

  useEffect(() => {
    actionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    if (!message.trim()) return;
    showToast({
      actionLabel,
      message,
      onAction: hasAction ? () => actionRef.current?.() : undefined,
      type,
    });
  }, [actionLabel, hasAction, message, showToast, type]);

  return null;
}
