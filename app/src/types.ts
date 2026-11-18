export interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  categoryId: string | null;
  /** сумма в копейках, целое > 0 */
  amountMinor: number;
  /** ISO-момент траты (локальное время + смещение) */
  createdAt: string;
  /** необязательный комментарий: «сигареты», «энергетик» */
  comment?: string;
  /** ISO-момент последнего редактирования */
  updatedAt?: string;
}

export type CurrencyCode = "RUB" | "USD" | "EUR" | "KZT" | "UAH" | "BYN";
export type ThemeMode = "system" | "light" | "dark";

export interface Settings {
  currency: CurrencyCode;
  theme: ThemeMode;
  lastCategoryId: string | null;
}

export type PeriodKind = "month" | "prev" | "quarter" | "year" | "custom";

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string;
  total: number;
  count: number;
  share: number;
  expenses: Expense[];
}

export interface ReportRange {
  start: Date;
  end: Date;
  label: string;
  days: number;
}
