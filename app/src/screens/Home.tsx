import { useMemo, useState } from "react";
import { isSameDay, startOfMonth } from "date-fns";
import { useApp, useCommentSuggestions } from "../store";
import { formatMoney, inputSuffix, parseAmountToMinor, sanitizeAmountInput } from "../lib/money";
import { monthTitle } from "../lib/dates";
import { plural } from "../lib/plural";
import { CategoryPicker } from "../components/CategoryPicker";
import { CommentField } from "../components/CommentField";
import { MonthDonut, type DonutSlice } from "../components/MonthDonut";
import { useToast } from "../components/Toast";
import { CheckIcon, ChevronDownIcon, MenuIcon } from "../components/Icons";

interface HomeScreenProps {
  onOpenMenu: () => void;
  onNavigate: (path: string) => void;
}

export function HomeScreen({ onOpenMenu, onNavigate }: HomeScreenProps) {
  const { categories, expenses, settings, addExpense, saveSettings } = useApp();
  const suggestions = useCommentSuggestions();
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const monthStart = startOfMonth(now);

  const { monthTotal, todayTotal, todayCount, monthSlices } = useMemo(() => {
    let month = 0;
    let today = 0;
    let count = 0;
    const byCategory = new Map<
      string | null,
      { name: string; color: string; total: number }
    >();

    for (const expense of expenses) {
      const date = new Date(expense.createdAt);
      if (date >= monthStart) {
        month += expense.amountMinor;
        const category = categories.find((c) => c.id === expense.categoryId) ?? null;
        const key = category?.id ?? null;
        const slice = byCategory.get(key) ?? {
          name: category?.name ?? "Без категории",
          color: category?.color ?? "#98A2B3",
          total: 0,
        };
        slice.total += expense.amountMinor;
        byCategory.set(key, slice);
      }
      if (isSameDay(date, now)) {
        today += expense.amountMinor;
        count += 1;
      }
    }

    const monthSlices: DonutSlice[] = [...byCategory.values()]
      .sort((a, b) => b.total - a.total)
      .map((slice) => ({
        ...slice,
        share: month > 0 ? Math.round((slice.total / month) * 100) : 0,
      }));

    return { monthTotal: month, todayTotal: today, todayCount: count, monthSlices };
  }, [expenses, categories, monthStart, now]);

  const selectedId =
    settings.lastCategoryId && categories.some((c) => c.id === settings.lastCategoryId)
      ? settings.lastCategoryId
      : categories[0]?.id ?? null;
  const category = categories.find((c) => c.id === selectedId) ?? null;

  const parsed = parseAmountToMinor(amount);
  const canSave = parsed !== null && category !== null && !saving;

  const handleSave = async () => {
    if (!parsed || !category) {
      setError("Введите сумму и выберите статью");
      return;
    }
    setSaving(true);
    const ok = await addExpense({
      categoryId: category.id,
      amountMinor: parsed,
      comment: comment.trim() || undefined,
    });
    setSaving(false);
    if (!ok) {
      showToast("Не удалось сохранить. Попробуйте ещё раз.", { tone: "error" });
      return;
    }
    if ("vibrate" in navigator) navigator.vibrate?.(10);
    showToast(`Расход ${formatMoney(parsed, settings.currency)} · ${category.name}`);
    setAmount("");
    setComment("");
    setError(null);
    saveSettings({ lastCategoryId: category.id });
  };

  const legend = monthSlices.slice(0, 3);
  const hiddenCount = monthSlices.length - legend.length;

  return (
    <div className="screen home">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Меню" onClick={onOpenMenu}>
          <MenuIcon />
        </button>
        <h1>Мои Расходы</h1>
        <span />
      </header>

      <div className="donut-block">
        <MonthDonut
          total={monthTotal}
          slices={monthSlices}
          monthLabel={monthTitle(now)}
          currency={settings.currency}
          onClick={() => onNavigate("/report?period=month")}
        />
        {monthSlices.length > 0 && (
          <div className="donut-legend">
            {legend.map((slice) => (
              <span key={slice.name} className="legend-chip">
                <span className="dot" style={{ background: slice.color }} />
                {slice.name}
                <span className="legend-share">{slice.share}%</span>
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="legend-chip muted">+{hiddenCount}</span>
            )}
          </div>
        )}
      </div>

      <div className="home-body">
        <div className="field">
          <span className="field-label">Статья расхода</span>
          <button
            type="button"
            className="category-trigger"
            onClick={() => setPickerOpen(true)}
            aria-label={`Статья расхода: ${category?.name ?? "не выбрана"}`}
          >
            <span
              className="dot"
              style={{ background: category?.color ?? "var(--muted)" }}
            />
            <span className="category-name">{category?.name ?? "Выберите статью"}</span>
            <ChevronDownIcon size={18} className="muted" />
          </button>
        </div>

        <CommentField
          value={comment}
          onChange={setComment}
          suggestions={suggestions}
        />

        <div className="amount-block">
          <div className="amount-row">
            <input
              className="amount-input"
              style={{ width: `${Math.max(amount.length, 1)}ch` }}
              value={amount}
              onChange={(event) => {
                setAmount(sanitizeAmountInput(event.target.value));
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSave) void handleSave();
              }}
              inputMode="decimal"
              placeholder="0"
              aria-label="Сумма расхода"
              autoComplete="off"
            />
            <span className="amount-suffix">{inputSuffix(settings.currency)}</span>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>

        <button
          type="button"
          className="round-ok"
          disabled={!canSave}
          onClick={handleSave}
          aria-label="Подтвердить расход"
          aria-disabled={!canSave}
        >
          <CheckIcon size={32} />
        </button>

        {todayCount > 0 && (
          <p className="today-line">
            Сегодня: {formatMoney(todayTotal, settings.currency)} · {todayCount}{" "}
            {plural(todayCount, "запись", "записи", "записей")}
          </p>
        )}
      </div>

      <CategoryPicker
        open={pickerOpen}
        categories={categories}
        selectedId={selectedId}
        onSelect={(id) => id && saveSettings({ lastCategoryId: id })}
        onClose={() => setPickerOpen(false)}
        onAddCategory={() => onNavigate("/settings?newCategory=1")}
      />
    </div>
  );
}
