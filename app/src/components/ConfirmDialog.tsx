import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (!open) {
      setTyped("");
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const canConfirm = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return createPortal(
    <div className="modal-root">
      <div className="modal-overlay" onClick={onCancel} />
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="modal-title">{title}</h2>
        {message && <div className="modal-message">{message}</div>}
        {requireText && (
          <div className="field">
            <label className="field-label" htmlFor={inputId}>
              Введите «{requireText}», чтобы продолжить
            </label>
            <input
              id={inputId}
              className="input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoCapitalize="characters"
              autoFocus
            />
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
