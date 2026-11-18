import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, PALETTE } from "../store";
import { CURRENCIES, formatMoney } from "../lib/money";
import { formatDateFull } from "../lib/dates";
import { plural } from "../lib/plural";
import { BottomSheet } from "../components/BottomSheet";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import {
  ArrowLeftIcon,
  DownloadIcon,
  GripIcon,
  InfoIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "../components/Icons";
import type { Category, CurrencyCode, ThemeMode } from "../types";

interface SettingsScreenProps {
  onBack: () => void;
  openNewCategory?: boolean;
}

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "Системная" },
  { id: "light", label: "Светлая" },
  { id: "dark", label: "Тёмная" },
];

export function SettingsScreen({ onBack, openNewCategory }: SettingsScreenProps) {
  const {
    categories,
    expenses,
    settings,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    saveSettings,
    exportData,
    importData,
    clearAll,
  } = useApp();
  const { showToast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const orderRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (openNewCategory) openCategoryEditor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const expense of expenses) {
      if (!expense.categoryId) continue;
      const current = map.get(expense.categoryId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += expense.amountMinor;
      map.set(expense.categoryId, current);
    }
    return map;
  }, [expenses]);

  const displayed = useMemo(() => {
    if (!order) return categories;
    const map = new Map(categories.map((category) => [category.id, category]));
    return order
      .map((id) => map.get(id))
      .filter((category): category is Category => Boolean(category));
  }, [order, categories]);

  function openCategoryEditor(category: Category | null) {
    setEditing(category);
    setName(category?.name ?? "");
    setColor(category?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    setFormError(null);
    setEditorOpen(true);
  }

  const saveCategory = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Введите название статьи");
      return;
    }
    if (trimmed.length > 30) {
      setFormError("Не больше 30 символов");
      return;
    }
    const duplicate = categories.some(
      (category) =>
        category.id !== editing?.id &&
        category.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setFormError("Такая категория уже есть");
      return;
    }
    if (editing) {
      const ok = await updateCategory(editing.id, { name: trimmed, color });
      if (!ok) {
        setFormError("Не удалось сохранить");
        return;
      }
      showToast("Статья изменена");
    } else {
      const created = await addCategory(trimmed, color);
      if (!created) {
        setFormError("Не удалось сохранить");
        return;
      }
      showToast("Статья добавлена");
    }
    setEditorOpen(false);
  };

  const confirmDeleteCategory = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const ok = await deleteCategory(target.id);
    if (!ok) {
      showToast("Не удалось удалить статью", { tone: "error" });
      return;
    }
    showToast("Статья удалена, записи остались как «Без категории»");
  };

  const startDrag = (event: React.PointerEvent, id: string) => {
    if (!listRef.current) return;
    const firstRow = listRef.current.querySelector<HTMLElement>(".cat-row");
    const rowHeight = firstRow ? firstRow.getBoundingClientRect().height : 60;
    const rect = listRef.current.getBoundingClientRect();
    const startOrder = categories.map((category) => category.id);
    orderRef.current = startOrder;
    setOrder(startOrder);
    setDragId(id);

    const onMove = (moveEvent: PointerEvent) => {
      const current = orderRef.current;
      if (!current) return;
      const index = Math.max(
        0,
        Math.min(current.length - 1, Math.floor((moveEvent.clientY - rect.top) / rowHeight)),
      );
      const from = current.indexOf(id);
      if (from === -1 || from === index) return;
      const next = [...current];
      next.splice(from, 1);
      next.splice(index, 0, id);
      orderRef.current = next;
      setOrder(next);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const finalOrder = orderRef.current;
      orderRef.current = null;
      setDragId(null);
      setOrder(null);
      if (finalOrder) void reorderCategories(finalOrder);
      event.preventDefault();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `expenses-backup-${formatDateFull(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Файл с данными сохранён");
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await importData(parsed);
      if (result.ok) showToast("Данные восстановлены");
      else showToast(result.error ?? "Файл не подходит", { tone: "error" });
    } catch {
      showToast("Не удалось прочитать файл", { tone: "error" });
    }
  };

  const deleteStats = deleteTarget
    ? stats.get(deleteTarget.id) ?? { count: 0, total: 0 }
    : { count: 0, total: 0 };

  return (
    <div className="screen">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Назад" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        <h1>Настройки</h1>
        <span />
      </header>

      <section className="section">
        <h2 className="section-title">Категории</h2>
        <div className="cat-list" ref={listRef}>
          {displayed.map((category) => {
            const info = stats.get(category.id);
            return (
              <div
                key={category.id}
                className={`cat-row ${dragId === category.id ? "dragging" : ""}`}
              >
                <button
                  type="button"
                  className="cat-row-main"
                  onClick={() => openCategoryEditor(category)}
                >
                  <span className="dot" style={{ background: category.color }} />
                  <span className="cat-row-name">{category.name}</span>
                  <span className="cat-row-count muted">
                    {info?.count
                      ? `${info.count} ${plural(info.count, "запись", "записи", "записей")}`
                      : "нет записей"}
                  </span>
                </button>
                <button
                  type="button"
                  className="drag-handle"
                  aria-label={`Переместить статью ${category.name}`}
                  onPointerDown={(event) => startDrag(event, category.id)}
                  style={{ touchAction: "none" }}
                >
                  <GripIcon size={20} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-soft add-category"
          onClick={() => openCategoryEditor(null)}
        >
          <PlusIcon size={18} /> Добавить категорию
        </button>
      </section>

      <section className="section">
        <h2 className="section-title">Приложение</h2>

        <div className="setting-row">
          <label className="setting-label" htmlFor="currency">
            Валюта
          </label>
          <select
            id="currency"
            className="select"
            value={settings.currency}
            onChange={(event) =>
              saveSettings({ currency: event.target.value as CurrencyCode })
            }
          >
            {Object.entries(CURRENCIES).map(([code, info]) => (
              <option key={code} value={code}>
                {info.symbol} · {info.label}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-block">
          <span className="setting-label">Тема</span>
          <div className="segmented segmented-flat">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`seg-btn ${settings.theme === theme.id ? "active" : ""}`}
                onClick={() => saveSettings({ theme: theme.id })}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="setting-row setting-button" onClick={handleExport}>
          <span className="setting-label">
            <DownloadIcon size={20} /> Экспорт данных
          </span>
        </button>

        <button
          type="button"
          className="setting-row setting-button"
          onClick={() => importRef.current?.click()}
        >
          <span className="setting-label">
            <UploadIcon size={20} /> Импорт данных
          </span>
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          className="setting-row setting-button danger-text"
          onClick={() => setClearOpen(true)}
        >
          <span className="setting-label">
            <TrashIcon size={20} /> Очистить все данные
          </span>
        </button>

        <button type="button" className="setting-row setting-button" onClick={() => setAboutOpen(true)}>
          <span className="setting-label">
            <InfoIcon size={20} /> О приложении
          </span>
        </button>
      </section>

      <p className="privacy-note">Данные хранятся только на этом устройстве.</p>

      <BottomSheet
        open={editorOpen}
        title={editing ? "Изменить статью" : "Новая статья"}
        onClose={() => setEditorOpen(false)}
        footer={
          <div className="editor-actions">
            {editing && (
              <button
                type="button"
                className="btn btn-ghost btn-delete"
                onClick={() => {
                  setEditorOpen(false);
                  setDeleteTarget(editing);
                }}
              >
                <TrashIcon size={18} /> Удалить
              </button>
            )}
            <button type="button" className="btn btn-primary grow" onClick={saveCategory}>
              Сохранить
            </button>
          </div>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="category-name">
            Название
          </label>
          <input
            id="category-name"
            className="input"
            value={name}
            maxLength={30}
            placeholder="Например, Ипотека"
            onChange={(event) => {
              setName(event.target.value);
              setFormError(null);
            }}
          />
        </div>

        <div className="field">
          <span className="field-label">Цвет</span>
          <div className="palette">
            {PALETTE.map((item) => (
              <button
                key={item}
                type="button"
                className={`swatch ${color.toLowerCase() === item.toLowerCase() ? "selected" : ""}`}
                style={{ background: item }}
                onClick={() => setColor(item)}
                aria-label={`Цвет ${item}`}
                aria-pressed={color.toLowerCase() === item.toLowerCase()}
              />
            ))}
            <label className="swatch custom-swatch" title="Другой цвет">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Другой цвет"
              />
              +
            </label>
          </div>
        </div>

        <div className="preview-row">
          <span className="dot" style={{ background: color }} />
          <span>{name.trim() || "Предпросмотр статьи"}</span>
        </div>

        {formError && <p className="form-error">{formError}</p>}
      </BottomSheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Удалить категорию?"
        message={
          deleteTarget
            ? deleteStats.count > 0
              ? `В категории «${deleteTarget.name}» ${deleteStats.count} ${plural(
                  deleteStats.count,
                  "запись",
                  "записи",
                  "записей",
                )} на ${formatMoney(deleteStats.total, settings.currency)}. Записи сохранятся в отчёте как «Без категории».`
              : `Категория «${deleteTarget.name}» пуста и будет удалена.`
            : undefined
        }
        confirmLabel="Удалить"
        danger
        onConfirm={confirmDeleteCategory}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Очистить все данные?"
        message="Будут удалены все расходы и настройки. Категории вернутся к стандартным. Отменить это действие нельзя."
        confirmLabel="Очистить"
        danger
        requireText="УДАЛИТЬ"
        onConfirm={async () => {
          setClearOpen(false);
          await clearAll();
          showToast("Данные очищены");
        }}
        onCancel={() => setClearOpen(false)}
      />

      <BottomSheet open={aboutOpen} title="О приложении" onClose={() => setAboutOpen(false)}>
        <p className="about-text">
          «Мои Расходы» — простой учёт личных трат. Версия 1.0.
        </p>
        <p className="about-text">
          Все записи хранятся только в браузере на этом устройстве. Приложение не отправляет
          данные в интернет, не требует регистрации и работает офлайн.
        </p>
        <p className="about-text muted">
          Перед очисткой браузера сделайте экспорт данных — восстановить их иначе не получится.
        </p>
      </BottomSheet>
    </div>
  );
}
