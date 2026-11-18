import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Category, Expense, Settings } from "./types";
import * as db from "./db";

const SETTINGS_KEY = "rashody.settings";
const SEED_KEY = "rashody.seeded";

const DEFAULT_SETTINGS: Settings = {
  currency: "RUB",
  theme: "system",
  lastCategoryId: null,
};

const DEFAULT_CATEGORIES: Array<[string, string]> = [
  ["Продукты", "#7CB342"],
  ["Кафе и рестораны", "#FB8C00"],
  ["Транспорт", "#039BE5"],
  ["Жильё", "#6D4C41"],
  ["Здоровье", "#E53935"],
  ["Развлечения", "#8E24AA"],
  ["Одежда", "#D81B60"],
  ["Прочее", "#546E7A"],
];

export const PALETTE = [
  "#E53935",
  "#FB8C00",
  "#FDD835",
  "#7CB342",
  "#00897B",
  "#039BE5",
  "#3949AB",
  "#8E24AA",
  "#D81B60",
  "#6D4C41",
  "#546E7A",
  "#000000",
];

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newCategory(name: string, color: string, sortOrder: number): Category {
  return {
    id: uid(),
    name: name.trim(),
    color,
    sortOrder,
    createdAt: new Date().toISOString(),
  };
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      currency: parsed.currency ?? "RUB",
      theme: parsed.theme ?? "system",
      lastCategoryId: parsed.lastCategoryId ?? null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* приватный режим — настройки не сохранятся */
  }
}

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export interface BackupFile {
  app: "rashody";
  version: 1;
  exportedAt: string;
  categories: Category[];
  expenses: Expense[];
  settings: Settings;
}

interface AppState {
  status: "loading" | "ready" | "error";
  error?: string;
  categories: Category[];
  expenses: Expense[];
  settings: Settings;
}

export interface AppContextValue extends AppState {
  addExpense(input: {
    categoryId: string | null;
    amountMinor: number;
    createdAt?: Date;
    comment?: string;
  }): Promise<boolean>;
  updateExpense(
    id: string,
    patch: {
      categoryId: string | null;
      amountMinor: number;
      createdAt: Date;
      comment?: string;
    },
  ): Promise<boolean>;
  deleteExpense(id: string): Promise<boolean>;
  restoreExpense(expense: Expense): Promise<void>;
  addCategory(name: string, color: string): Promise<Category | null>;
  updateCategory(
    id: string,
    patch: Partial<Pick<Category, "name" | "color">>,
  ): Promise<boolean>;
  deleteCategory(id: string): Promise<boolean>;
  reorderCategories(orderedIds: string[]): Promise<void>;
  saveSettings(patch: Partial<Settings>): void;
  exportData(): BackupFile;
  importData(payload: unknown): Promise<{ ok: boolean; error?: string }>;
  clearAll(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    status: "loading",
    categories: [],
    expenses: [],
    settings: loadSettings(),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let { categories, expenses } = await db.readAll();
        if (categories.length === 0 && !localStorage.getItem(SEED_KEY)) {
          const seeded = DEFAULT_CATEGORIES.map(([name, color], index) =>
            newCategory(name, color, (index + 1) * 10),
          );
          await db.putCategories(seeded);
          localStorage.setItem(SEED_KEY, "1");
          categories = seeded;
        }
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          status: "ready",
          categories: sortCategories(categories),
          expenses: sortExpenses(expenses),
        }));
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          error:
            "Не удалось открыть хранилище браузера. Данные не сохранятся — проверьте приватный режим.",
        }));
        console.error(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addExpense = useCallback<AppContextValue["addExpense"]>(async (input) => {
    const createdAt = input.createdAt ?? new Date();
    const comment = input.comment?.trim();
    const expense: Expense = {
      id: uid(),
      categoryId: input.categoryId,
      amountMinor: input.amountMinor,
      createdAt: createdAt.toISOString(),
      ...(comment ? { comment } : {}),
    };
    try {
      await db.putExpense(expense);
      setState((prev) => ({ ...prev, expenses: sortExpenses([expense, ...prev.expenses]) }));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, []);

  const updateExpense = useCallback<AppContextValue["updateExpense"]>(
    async (id, patch) => {
      const comment = patch.comment?.trim();
      try {
        setState((prev) => {
          const next = prev.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  categoryId: patch.categoryId,
                  amountMinor: patch.amountMinor,
                  createdAt: patch.createdAt.toISOString(),
                  comment,
                  updatedAt: new Date().toISOString(),
                }
              : e,
          );
          return { ...prev, expenses: sortExpenses(next) };
        });
        const current = state.expenses.find((e) => e.id === id);
        if (!current) return false;
        await db.putExpense({
          ...current,
          categoryId: patch.categoryId,
          amountMinor: patch.amountMinor,
          createdAt: patch.createdAt.toISOString(),
          comment,
          updatedAt: new Date().toISOString(),
        });
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    [state.expenses],
  );

  const deleteExpense = useCallback<AppContextValue["deleteExpense"]>(async (id) => {
    try {
      await db.removeExpense(id);
      setState((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== id),
      }));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, []);

  const restoreExpense = useCallback<AppContextValue["restoreExpense"]>(async (expense) => {
    await db.putExpense(expense);
    setState((prev) => ({ ...prev, expenses: sortExpenses([expense, ...prev.expenses]) }));
  }, []);

  const addCategory = useCallback<AppContextValue["addCategory"]>(
    async (name, color) => {
      const trimmed = name.trim();
      const maxOrder = state.categories.reduce(
        (max, category) => Math.max(max, category.sortOrder),
        0,
      );
      const category = newCategory(trimmed, color, maxOrder + 10);
      try {
        await db.putCategory(category);
        setState((prev) => ({ ...prev, categories: [...prev.categories, category] }));
        return category;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [state.categories],
  );

  const updateCategory = useCallback<AppContextValue["updateCategory"]>(
    async (id, patch) => {
      try {
        const current = state.categories.find((c) => c.id === id);
        if (!current) return false;
        const updated: Category = { ...current, ...patch, name: patch.name?.trim() ?? current.name };
        await db.putCategory(updated);
        setState((prev) => ({
          ...prev,
          categories: sortCategories(prev.categories.map((c) => (c.id === id ? updated : c))),
        }));
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    [state.categories],
  );

  const deleteCategory = useCallback<AppContextValue["deleteCategory"]>(async (id) => {
    try {
      await db.detachExpensesFromCategory(id);
      await db.removeCategory(id);
      setState((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        expenses: prev.expenses.map((e) =>
          e.categoryId === id ? { ...e, categoryId: null } : e,
        ),
        settings:
          prev.settings.lastCategoryId === id
            ? { ...prev.settings, lastCategoryId: null }
            : prev.settings,
      }));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, []);

  const reorderCategories = useCallback<AppContextValue["reorderCategories"]>(
    async (orderedIds) => {
      const reordered = orderedIds
        .map((id, index) => {
          const category = state.categories.find((c) => c.id === id);
          return category ? { ...category, sortOrder: (index + 1) * 10 } : null;
        })
        .filter((c): c is Category => c !== null);
      setState((prev) => ({ ...prev, categories: reordered }));
      await db.putCategories(reordered);
    },
    [state.categories],
  );

  const saveSettings = useCallback<AppContextValue["saveSettings"]>((patch) => {
    setState((prev) => {
      const settings = { ...prev.settings, ...patch };
      persistSettings(settings);
      return { ...prev, settings };
    });
  }, []);

  const exportData = useCallback<AppContextValue["exportData"]>(
    () => ({
      app: "rashody",
      version: 1,
      exportedAt: new Date().toISOString(),
      categories: state.categories,
      expenses: state.expenses,
      settings: state.settings,
    }),
    [state.categories, state.expenses, state.settings],
  );

  const importData = useCallback<AppContextValue["importData"]>(async (payload) => {
    const data = payload as Partial<BackupFile> | null;
    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.categories) ||
      !Array.isArray(data.expenses)
    ) {
      return { ok: false, error: "Файл не похож на резервную копию «Расходов»." };
    }
    const categories: Category[] = [];
    for (const raw of data.categories) {
      const c = raw as Partial<Category>;
      if (
        typeof c?.id !== "string" ||
        typeof c?.name !== "string" ||
        typeof c?.color !== "string" ||
        typeof c?.sortOrder !== "number"
      ) {
        return { ok: false, error: "Повреждён список категорий." };
      }
      categories.push({
        id: c.id,
        name: c.name,
        color: c.color,
        sortOrder: c.sortOrder,
        createdAt: c.createdAt ?? new Date().toISOString(),
      });
    }
    const expenses: Expense[] = [];
    for (const raw of data.expenses) {
      const e = raw as Partial<Expense>;
      if (
        typeof e?.id !== "string" ||
        typeof e?.amountMinor !== "number" ||
        !Number.isFinite(e.amountMinor) ||
        e.amountMinor <= 0 ||
        typeof e?.createdAt !== "string"
      ) {
        return { ok: false, error: "Повреждён список расходов." };
      }
      expenses.push({
        id: e.id,
        categoryId: typeof e.categoryId === "string" ? e.categoryId : null,
        amountMinor: Math.round(e.amountMinor),
        createdAt: e.createdAt,
        comment: typeof e.comment === "string" ? e.comment : undefined,
        updatedAt: e.updatedAt,
      });
    }
    await db.replaceAll(categories, expenses);
    localStorage.setItem(SEED_KEY, "1");
    const imported = (data.settings ?? {}) as Partial<Settings>;
    const allowedCurrencies: Settings["currency"][] = [
      "RUB",
      "USD",
      "EUR",
      "KZT",
      "UAH",
      "BYN",
    ];
    const allowedThemes: Settings["theme"][] = ["system", "light", "dark"];
    const nextSettings: Settings = {
      currency: allowedCurrencies.includes(imported.currency as Settings["currency"])
        ? (imported.currency as Settings["currency"])
        : state.settings.currency,
      theme: allowedThemes.includes(imported.theme as Settings["theme"])
        ? (imported.theme as Settings["theme"])
        : state.settings.theme,
      lastCategoryId:
        imported.lastCategoryId && categories.some((c) => c.id === imported.lastCategoryId)
          ? imported.lastCategoryId
          : null,
    };
    persistSettings(nextSettings);
    setState((prev) => ({
      ...prev,
      categories: sortCategories(categories),
      expenses: sortExpenses(expenses),
      settings: nextSettings,
    }));
    return { ok: true };
  }, [state.settings]);

  const clearAll = useCallback<AppContextValue["clearAll"]>(async () => {
    await db.clearEverything();
    localStorage.removeItem(SEED_KEY);
    const seeded = DEFAULT_CATEGORIES.map(([name, color], index) =>
      newCategory(name, color, (index + 1) * 10),
    );
    await db.putCategories(seeded);
    localStorage.setItem(SEED_KEY, "1");
    const settings = { ...DEFAULT_SETTINGS };
    persistSettings(settings);
    setState((prev) => ({
      ...prev,
      categories: sortCategories(seeded),
      expenses: [],
      settings,
    }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      addExpense,
      updateExpense,
      deleteExpense,
      restoreExpense,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
      saveSettings,
      exportData,
      importData,
      clearAll,
    }),
    [
      state,
      addExpense,
      updateExpense,
      deleteExpense,
      restoreExpense,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
      saveSettings,
      exportData,
      importData,
      clearAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export interface CommentStat {
  key: string;
  text: string;
  count: number;
  total: number;
  lastUsed: number;
}

/** Уникальные комментарии: сначала недавние, затем частые — для подсказок в поле ввода. */
export function useCommentSuggestions(): string[] {
  const { expenses } = useApp();
  return useMemo(() => {
    const map = new Map<string, CommentStat>();
    for (const expense of expenses) {
      const raw = expense.comment?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const stat = map.get(key) ?? { key, text: raw, count: 0, total: 0, lastUsed: 0 };
      stat.count += 1;
      stat.total += expense.amountMinor;
      stat.lastUsed = Math.max(stat.lastUsed, new Date(expense.createdAt).getTime());
      map.set(key, stat);
    }
    return [...map.values()]
      .sort((a, b) => b.lastUsed - a.lastUsed || b.count - a.count)
      .map((stat) => stat.text);
  }, [expenses]);
}

/** Агрегация комментариев по выбранным записям (для отчёта). */
export function aggregateComments(expenses: Expense[]): CommentStat[] {
  const map = new Map<string, CommentStat>();
  for (const expense of expenses) {
    const raw = expense.comment?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const stat = map.get(key) ?? { key, text: raw, count: 0, total: 0, lastUsed: 0 };
    stat.count += 1;
    stat.total += expense.amountMinor;
    stat.lastUsed = Math.max(stat.lastUsed, new Date(expense.createdAt).getTime());
    map.set(key, stat);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.total - a.total);
}

export function findCategory(
  categories: Category[],
  id: string | null,
): Category | undefined {
  if (!id) return undefined;
  return categories.find((c) => c.id === id);
}
