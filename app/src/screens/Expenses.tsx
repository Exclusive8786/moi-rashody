import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useCommentSuggestions } from "../store";
import { formatMoney } from "../lib/money";
import { formatDateTime, sumMinor } from "../lib/dates";
import { plural } from "../lib/plural";
import { SwipeRow } from "../components/SwipeRow";
import { ExpenseEditor } from "../components/ExpenseEditor";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { ArrowLeftIcon, PlusIcon } from "../components/Icons";
import type { Expense } from "../types";

interface ExpensesScreenProps {
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export function ExpensesScreen({ onBack, onNavigate }: ExpensesScreenProps) {
  const { categories, expenses, settings, updateExpense, deleteExpense, restoreExpense } = useApp();
  const { showToast } = useToast();
  const suggestions = useCommentSuggestions();
  const [visibleCount, setVisibleCount] = useState(50);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const total = useMemo(() => sumMinor(expenses), [expenses]);
  const visible = expenses.slice(0, visibleCount);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + 50, expenses.length));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [expenses.length]);

  const nameOf = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId)?.name ?? "Без категории";
  const colorOf = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId)?.color ?? "var(--muted)";

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const removed = deleteTarget;
    setDeleteTarget(null);
    const ok = await deleteExpense(removed.id);
    if (!ok) {
      showToast("Не удалось удалить запись", { tone: "error" });
      return;
    }
    showToast("Запись удалена", {
      action: {
        label: "Отменить",
        onClick: () => {
          void restoreExpense(removed);
        },
      },
      duration: 5000,
    });
  };

  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        <h1>Расходы</h1>
        <span />
      </header>

      <div className="list-summary">
        <span>Всего</span>
        <strong>{formatMoney(total, settings.currency)}</strong>
        <span className="muted">
          {expenses.length} {plural(expenses.length, "запись", "записи", "записей")}
        </span>
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state">
          <p>Пока нет ни одной записи</p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("/")}>
            <PlusIcon size={18} /> Добавить расход
          </button>
        </div>
      ) : (
        <div className="list">
          {visible.map((expense) => (
            <SwipeRow
              key={expense.id}
              onTap={() => setEditing(expense)}
              onDelete={() => setDeleteTarget(expense)}
            >
              <button
                type="button"
                className="exp-row"
                aria-label={[nameOf(expense.categoryId), expense.comment, formatMoney(expense.amountMinor, settings.currency), formatDateTime(new Date(expense.createdAt))].filter(Boolean).join(", ")}
              >
                <span className="dot" style={{ background: colorOf(expense.categoryId) }} />
                <div className="exp-main">
                  <span className="exp-name">{nameOf(expense.categoryId)}</span>
                  <span className="exp-date">
                    {formatDateTime(new Date(expense.createdAt))}
                    {expense.updatedAt && <span className="edited-mark"> · изм.</span>}
                  </span>
                  {expense.comment && (
                    <span className="exp-note">«{expense.comment}»</span>
                  )}
                </div>
                <span className="exp-amount">
                  {formatMoney(expense.amountMinor, settings.currency)}
                </span>
              </button>
            </SwipeRow>
          ))}
          {visibleCount < expenses.length && <div ref={sentinelRef} className="sentinel" />}
        </div>
      )}

      <ExpenseEditor
        open={editing !== null}
        expense={editing}
        categories={categories}
        suggestions={suggestions}
        currency={settings.currency}
        onClose={() => setEditing(null)}
        onSave={async (id, patch) => {
          const ok = await updateExpense(id, patch);
          if (ok) showToast("Запись изменена");
          return ok;
        }}
        onRequestDelete={(expense) => {
          setEditing(null);
          setDeleteTarget(expense);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Удалить запись?"
        message={
          deleteTarget
            ? `${formatMoney(deleteTarget.amountMinor, settings.currency)} · ${formatDateTime(
                new Date(deleteTarget.createdAt),
              )}. Действие можно будет отменить в течение 5 секунд.`
            : undefined
        }
        confirmLabel="Удалить"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
