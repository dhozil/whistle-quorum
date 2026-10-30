import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Dispute } from "../lib/types";
import { outcomeLabel, outcomeTone, label as titleCase } from "../lib/format";

export function StatusChip({ status }: { status: Dispute["status"] }) {
  return <span className={`chip chip--${status.toLowerCase()}`}>{titleCase(status)}</span>;
}

export function OutcomePill({ outcome }: { outcome: string }) {
  return (
    <span className={`outcome-pill outcome-pill--${outcomeTone(outcome)}`}>
      {outcomeLabel(outcome)}
    </span>
  );
}

interface ModalProps {
  kicker: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ kicker, title, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__head">
          <div>
            <p className="kicker">{kicker}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  full?: boolean;
}

export function Field({ label, hint, children, full }: FieldProps) {
  return (
    <label className={`field ${full ? "field--full" : ""}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input input--area ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input input--select ${props.className ?? ""}`} />;
}

export function Spinner({ small }: { small?: boolean }) {
  return <span className={`spinner ${small ? "spinner--small" : ""}`} aria-hidden="true" />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="note note--error">{children}</p>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <svg viewBox="0 0 120 80" className="empty__art" aria-hidden="true">
        <circle cx="60" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
        <path d="M60 10v60M30 40h60" stroke="currentColor" strokeWidth="1" opacity=".35" />
        <circle cx="60" cy="40" r="3" fill="currentColor" />
      </svg>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const filled = Math.round(Math.min(100, Math.max(0, value)) / 5);
  return (
    <div className="meter" role="img" aria-label={`Confidence ${value} of 100`}>
      {Array.from({ length: 20 }, (_, index) => (
        <span key={index} className={index < filled ? "is-on" : ""} />
      ))}
    </div>
  );
}
