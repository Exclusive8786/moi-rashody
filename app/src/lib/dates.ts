import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import { ru } from "date-fns/locale";
import type { Expense, PeriodKind, ReportRange } from "../types";

export type CustomRange = { from: Date; to: Date };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function monthTitle(date: Date): string {
  return cap(format(date, "LLLL", { locale: ru }));
}

export function formatDateFull(date: Date): string {
  return format(date, "dd.MM.yyyy");
}

export function formatTime(date: Date): string {
  return format(date, "HH:mm");
}

export function formatDateTime(date: Date): string {
  return `${formatDateFull(date)} ${formatTime(date)}`;
}

export function formatDayHeader(date: Date): string {
  return `${format(date, "d MMMM", { locale: ru })}, ${format(date, "EEEE", {
    locale: ru,
  })}`;
}

export function formatRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) return format(start, "d MMMM yyyy", { locale: ru });
  if (isSameMonth(start, end)) {
    return `${format(start, "d")}–${format(end, "d MMMM yyyy", { locale: ru })}`;
  }
  if (isSameYear(start, end)) {
    return `${format(start, "d MMM", { locale: ru })} – ${format(end, "d MMM yyyy", {
      locale: ru,
    })}`;
  }
  return `${format(start, "d MMM yyyy", { locale: ru })} – ${format(end, "d MMM yyyy", {
    locale: ru,
  })}`;
}

export function daysCount(start: Date, end: Date): number {
  return Math.max(1, differenceInCalendarDays(end, start) + 1);
}

/** Границы периода отчёта. Текущие периоды считаются «до сегодня». */
export function periodRange(
  kind: PeriodKind,
  custom: CustomRange,
  now: Date = new Date(),
): ReportRange {
  let start: Date;
  let end: Date;
  switch (kind) {
    case "prev": {
      const p = subMonths(now, 1);
      start = startOfMonth(p);
      end = endOfMonth(p);
      break;
    }
    case "quarter": {
      start = startOfQuarter(now);
      end = now;
      break;
    }
    case "year": {
      start = startOfYear(now);
      end = now;
      break;
    }
    case "custom": {
      start = startOfDay(custom.from);
      end = endOfDay(custom.to);
      break;
    }
    case "month":
    default: {
      start = startOfMonth(now);
      end = now;
      break;
    }
  }
  return { start, end, label: formatRange(start, end), days: daysCount(start, end) };
}

/** Период той же длины, непосредственно предшествующий текущему. */
export function previousRange(
  kind: PeriodKind,
  current: ReportRange,
  now: Date = new Date(),
): { start: Date; end: Date } {
  switch (kind) {
    case "month": {
      const p = subMonths(now, 1);
      return { start: startOfMonth(p), end: endOfMonth(p) };
    }
    case "prev": {
      const p = subMonths(now, 2);
      return { start: startOfMonth(p), end: endOfMonth(p) };
    }
    case "quarter": {
      const q = subQuarters(startOfQuarter(now), 1);
      return { start: startOfQuarter(q), end: endOfQuarter(q) };
    }
    case "year": {
      const y = subYears(now, 1);
      return { start: startOfYear(y), end: endOfYear(y) };
    }
    case "custom":
    default: {
      const prevEnd = endOfDay(subDays(current.start, 1));
      const prevStart = startOfDay(subDays(prevEnd, current.days - 1));
      return { start: prevStart, end: prevEnd };
    }
  }
}

export function inRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function sumMinor(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + e.amountMinor, 0);
}

export function groupByDay(
  expenses: Expense[],
): { date: Date; total: number; items: Expense[] }[] {
  const groups = new Map<string, { date: Date; total: number; items: Expense[] }>();
  for (const expense of expenses) {
    const date = new Date(expense.createdAt);
    const key = format(date, "yyyy-MM-dd");
    let group = groups.get(key);
    if (!group) {
      group = { date: startOfDay(date), total: 0, items: [] };
      groups.set(key, group);
    }
    group.total += expense.amountMinor;
    group.items.push(expense);
  }
  return [...groups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function isFutureDateTime(date: Date, now: Date = new Date()): boolean {
  return date.getTime() > now.getTime();
}

export function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function toTimeInputValue(date: Date): string {
  return format(date, "HH:mm");
}

export function fromDateAndTime(dateValue: string, timeValue: string): Date | null {
  if (!dateValue || !timeValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
