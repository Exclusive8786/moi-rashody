import { useEffect, useState } from "react";
import type { Category, CurrencyCode, Expense } from "../types";
import {
  inputSuffix,
  minorToInput,
  parseAmountToMinor,
  sanitizeAmountInput,
} from "../lib/money";
import {
  fromDateAndTime,
  toDateInputValue,
  toTimeInputValue,
} from "../lib/dates";
import { BottomSheet } from "./BottomSheet";
import { CategoryPicker } from "./CategoryPicker";
import { CommentField } from "./CommentField";
import { ChevronDownIcon, TrashIcon } from "./Icons";

interface ExpenseEditorProps {
  open: boolean;
  expense: Expense | null;
  categories: Category[];
  suggestions: string[];
  currency: CurrencyCode;
  onClose: () => void;
  onSave: (
    id: string,
    patch: {
      categoryId: string | null;
      amountMinor: number;
      createdAt: Date;
      comment?: string;
    },
  ) => Promise<boolean>;
  onRequestDelete: (expense: Expense) => void;
}

export function ExpenseEditor({
  open,
  expense,
  categories,
  suggestions,
  currency,
  onClose,
  onSave,
  onRequestDelete,
}: ExpenseEditorProps) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !expense) return;
    const date = new Date(expense.createdAt);
    setAmount(minorToInput(expense.amountMinor));
    setCategoryId(expense.categoryId);
    setComment(expense.comment ?? "");
    setDateValue(toDateInputValue(date));
    setTimeValue(toTimeInputValue(date));
    setError(null);
    setSaving(false);
  }, [open, expense]);

  if (!expense) return null;

  const category = categories.find((item) => item.id === categoryId) ?? null;
  const parsed = parseAmountToMinor(amount);
  const today = toDateInputValue(new Date());
  const canSave = parsed !== null && dateValue !== "" && timeValue !== "" && !saving;

  const handleSave = async () => {
    if (!parsed) {
      setError("Введите сумму больше нуля");
      return;
    }
    const createdAt = fromDateAndTime(dateValue, timeValue);
    if (!createdAt) {
      setError("Проверьте дату и время");
      return;
    }
    if (createdAt.getTime() > Date.now() + 60_000) {
      setError("Дата и время не могут быть в будущем");
      return;
    }
    setSaving(true);
    const ok = await onSave(expense.id, {
      categoryId,
      amountMinor: parsed,
      createdAt,
      comment: comment.trim() || undefined,
    });
    setSaving(false);
    if (ok) onClose();
    else setError("Не удалось сохранить. Попробуйте ещё раз.");
  };

  return (
    <>
      <BottomSheet
        open={open}
        title="Изменить расход"
        onClose={onClose}
        footer={
          <div className="editor-actions">
            <button
              type="button"
              className="btn btn-ghost btn-delete"
              onClick={() => onRequestDelete(expense)}
            >
              <TrashIcon size={18} /> Удалить
            </button>
            <button
              type="button"
              className="btn btn-primary grow"
              onClick={handleSave}
              disabled={!canSave}
            >
              Сохранить
            </button>
          </div>
        }
      >
        <div className="editor-amount">
          <input
            className="amount-input amount-input-sm"
            value={amount}
            onChange={(event) => {
              setAmount(sanitizeAmountInput(event.target.value));
              setError(null);
            }}
            inputMode="decimal"
            aria-label="Сумма расхода"
            placeholder="0"
          />
          <span className="amount-suffix">{inputSuffix(currency)}</span>
        </div>

        <button
          type="button"
          className="category-trigger"
          onClick={() => setPickerOpen(true)}
        >
          <span
            className="dot"
            style={{ background: category?.color ?? "var(--muted)" }}
          />
          <span className="category-name">{category?.name ?? "Без категории"}</span>
          <ChevronDownIcon size={18} className="muted" />
        </button>

        <CommentField value={comment} onChange={setComment} suggestions={suggestions} />

        <div className="editor-grid">
          <div className="field">
            <label className="field-label" htmlFor="expense-date">
              Дата
            </label>
            <input
              id="expense-date"
              type="date"
              className="input"
              value={dateValue}
              max={today}
              onChange={(event) => {
                setDateValue(event.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="expense-time">
              Время
            </label>
            <input
              id="expense-time"
              type="time"
              className="input"
              value={timeValue}
              onChange={(event) => {
                setTimeValue(event.target.value);
                setError(null);
              }}
            />
          </div>
        </div>

        {expense.updatedAt && (
          <p className="hint">
            Изменено {new Date(expense.updatedAt).toLocaleString("ru-RU")}
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
      </BottomSheet>

      <CategoryPicker
        open={pickerOpen}
        title="Статья расхода"
        categories={categories}
        selectedId={categoryId}
        allowNull
        onSelect={setCategoryId}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
