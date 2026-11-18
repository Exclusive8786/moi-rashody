import { useMemo, useState } from "react";
import { aggregateComments, useApp, useCommentSuggestions } from "../store";
import { formatMoney } from "../lib/money";
import {
  formatDateTime,
  formatDayHeader,
  formatTime,
  groupByDay,
  inRange,
  isFutureDateTime,
  periodRange,
  previousRange,
  sumMinor,
  toDateInputValue,
} from "../lib/dates";
import { plural } from "../lib/plural";
import type { Expense, PeriodKind } from "../types";
import { ExpenseEditor } from "../components/ExpenseEditor";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
} from "../components/Icons";

interface ReportScreenProps {
  onBack: () => void;
  onNavigate: (path: string) => void;
  initialPeriod?: PeriodKind;
}

const PERIODS: { id: PeriodKind; label: string }[] = [
  { id: "month", label: "Этот месяц" },
  { id: "prev", label: "Прошлый месяц" },
  { id: "quarter", label: "Квартал" },
  { id: "year", label: "Год" },
  { id: "custom", label: "Период" },
];

export function ReportScreen({ onBack, onNavigate, initialPeriod = "month" }: ReportScreenProps) {
  const { categories, expenses, settings, updateExpense, deleteExpense, restoreExpense } = useApp();
  const { showToast } = useToast();
  const suggestions = useCommentSuggestions();
  const [kind, setKind] = useState<PeriodKind>(initialPeriod);
  const [fromValue, setFromValue] = useState(toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [toValue, setToValue] = useState(toDateInputValue(new Date()));
  const [expanded, setExpanded] = useState<Set<string | null>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const now = new Date();
  const customFrom = new Date(`${fromValue}T00:00:00`);
  const customTo = new Date(`${toValue}T00:00:00`);
  const customValid =
    !Number.isNaN(customFrom.getTime()) &&
    !Number.isNaN(customTo.getTime()) &&
    customFrom.getTime() <= customTo.getTime();

  const range = periodRange(kind, { from: customFrom, to: customTo }, now);

  const inPeriod = useMemo(
    () =>
      expenses.filter((e) =>
        inRange(new Date(e.createdAt), range.start, range.end),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, range.start.getTime(), range.end.getTime()],
  );

  const total = sumMinor(inPeriod);
  const prev = previousRange(kind, range, now);
  const prevTotal = sumMinor(
    expenses.filter((e) => inRange(new Date(e.createdAt), prev.start, prev.end)),
  );
  const delta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const average = Math.round(total / range.days / 100) * 100;

  const slices = useMemo(() => {
    const map = new Map<
      string | null,
      { categoryId: string | null; name: string; color: string; total: number; expenses: Expense[] }
    >();
    for (const expense of inPeriod) {
      const category = categories.find((c) => c.id === expense.categoryId) ?? null;
      const key = category ? category.id : null;
      let slice = map.get(key);
      if (!slice) {
        slice = {
          categoryId: key,
          name: category?.name ?? "Без категории",
          color: category?.color ?? "#98A2B3",
          total: 0,
          expenses: [],
        };
        map.set(key, slice);
      }
      slice.total += expense.amountMinor;
      slice.expenses.push(expense);
    }
    return [...map.values()]
      .sort((a, b) => b.total - a.total)
      .map((slice) => ({
        ...slice,
        count: slice.expenses.length,
        share: total > 0 ? Math.round((slice.total / total) * 100) : 0,
        days: groupByDay(slice.expenses),
      }));
  }, [inPeriod, categories, total]);

  const commentStats = useMemo(() => aggregateComments(inPeriod), [inPeriod]);

  const toggle = (id: string | null) => {
    setExpanded((prevSet) => {
      const next = new Set(prevSet);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleComment = (key: string) => {
    setExpandedComments((prevSet) => {
      const next = new Set(prevSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      action: { label: "Отменить", onClick: () => void restoreExpense(removed) },
      duration: 5000,
    });
  };

  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        <h1>Отчёт</h1>
        <span />
      </header>

      <div className="segmented" role="tablist" aria-label="Период отчёта">
        {PERIODS.map((period) => (
          <button
            key={period.id}
            type="button"
            role="tab"
            aria-selected={kind === period.id}
            className={`seg-btn ${kind === period.id ? "active" : ""}`}
            onClick={() => setKind(period.id)}
          >
            {period.label}
          </button>
        ))}
      </div>

      {kind === "custom" && (
        <div className="custom-range">
          <div className="field">
            <label className="field-label" htmlFor="range-from">
              С
            </label>
            <input
              id="range-from"
              type="date"
              className="input"
              value={fromValue}
              max={toValue || toDateInputValue(now)}
              onChange={(event) => setFromValue(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="range-to">
              По
            </label>
            <input
              id="range-to"
              type="date"
              className="input"
              value={toValue}
              max={toDateInputValue(now)}
              onChange={(event) => setToValue(event.target.value)}
            />
          </div>
        </div>
      )}

      {!customValid && <p className="form-error pad">Начало периода позже конца</p>}

      {customValid && (
        <>
      <section className="summary-card">
        <div className="summary-label">{range.label}</div>
        <div className="summary-total">{formatMoney(total, settings.currency)}</div>
        <div className="summary-meta">
          {inPeriod.length} {plural(inPeriod.length, "запись", "записи", "записей")}
          <span className="dot-sep">·</span>
          в среднем {formatMoney(average, settings.currency)} в день
        </div>
        <div className={`delta ${delta === null ? "muted" : delta > 0 ? "up" : "down"}`}>
          {delta === null
            ? "Нет данных для сравнения"
            : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}% к прошлому периоду`}
        </div>
      </section>

      {inPeriod.length === 0 ? (
        <div className="empty-state">
          <p>За этот период расходов нет</p>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("/")}>
            <PlusIcon size={18} /> Добавить расход
          </button>
        </div>
      ) : (
        <div className="breakdown">
          {slices.map((slice) => {
            const isOpen = expanded.has(slice.categoryId);
            return (
              <div key={slice.categoryId ?? "none"} className="cat-block">
                <button
                  type="button"
                  className="cat-head"
                  onClick={() => toggle(slice.categoryId)}
                  aria-expanded={isOpen}
                >
                  <span className="dot" style={{ background: slice.color }} />
                  <span className="cat-name">{slice.name}</span>
                  <span className="cat-share muted">{slice.share}%</span>
                  <span className="cat-sum">{formatMoney(slice.total, settings.currency)}</span>
                  {isOpen ? <ChevronDownIcon size={18} /> : <ChevronRightIcon size={18} />}
                </button>
                <div className="bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.max(slice.share, 2)}%`, background: slice.color }}
                  />
                </div>
                {isOpen && (
                  <div className="entries">
                    {slice.days.map((day) => (
                      <div key={day.date.toISOString()} className="day-group">
                        <div className="day-head">
                          {formatDayHeader(day.date)}
                          <span>{formatMoney(day.total, settings.currency)}</span>
                        </div>
                        {day.items.map((expense) => (
                          <button
                            key={expense.id}
                            type="button"
                            className="entry"
                            onClick={() => setEditing(expense)}
                          >
                            <span>{formatTime(new Date(expense.createdAt))}</span>
                            {expense.comment && (
                              <span className="entry-note">{expense.comment}</span>
                            )}
                            <span className="entry-amount">
                              {formatMoney(expense.amountMinor, settings.currency)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {inPeriod.length > 0 && commentStats.length > 0 && (
        <section className="comments-block">
          <h2 className="section-title comments-title">По комментариям</h2>
          {commentStats.map((stat) => {
            const isOpen = expandedComments.has(stat.key);
            const items = inPeriod.filter(
              (expense) =>
                (expense.comment ?? "").trim().toLowerCase() === stat.key,
            );
            return (
              <div key={stat.key} className="comment-block">
                <button
                  type="button"
                  className="comment-head"
                  onClick={() => toggleComment(stat.key)}
                  aria-expanded={isOpen}
                >
                  <span className="comment-name">{stat.text}</span>
                  <span className="comment-count">×{stat.count}</span>
                  <span className="comment-sum">
                    {formatMoney(stat.total, settings.currency)}
                  </span>
                  {isOpen ? <ChevronDownIcon size={18} /> : <ChevronRightIcon size={18} />}
                </button>
                {isOpen && (
                  <div className="entries comment-entries">
                    {items.map((expense) => (
                      <button
                        key={expense.id}
                        type="button"
                        className="entry"
                        onClick={() => setEditing(expense)}
                      >
                        <span>{formatDateTime(new Date(expense.createdAt))}</span>
                        <span className="entry-amount">
                          {formatMoney(expense.amountMinor, settings.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {inPeriod.length > 0 && (
        <div className="total-row">
          <span>Всего за период</span>
          <strong>{formatMoney(total, settings.currency)}</strong>
        </div>
      )}
        </>
      )}

      <ExpenseEditor
        open={editing !== null}
        expense={editing}
        categories={categories}
        suggestions={suggestions}
        currency={settings.currency}
        onClose={() => setEditing(null)}
        onSave={async (id, patch) => {
          if (isFutureDateTime(patch.createdAt)) {
            showToast("Дата и время не могут быть в будущем", { tone: "error" });
            return false;
          }
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
            ? `${formatMoney(deleteTarget.amountMinor, settings.currency)}. Действие можно отменить в течение 5 секунд.`
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
