import { describe, expect, it } from "vitest";
import { formatMoney, parseAmountToMinor, sanitizeAmountInput } from "./money";
import { periodRange, previousRange, formatRange } from "./dates";

describe("сумма", () => {
  it("чистит ввод до цифр и одного разделителя", () => {
    expect(sanitizeAmountInput("12a3,4")).toBe("123.4");
    expect(sanitizeAmountInput("1.2.3")).toBe("1.23");
    expect(sanitizeAmountInput("0007")).toBe("7");
    expect(sanitizeAmountInput("-50")).toBe("50");
    expect(sanitizeAmountInput("99999999999")).toBe("999999999");
    expect(sanitizeAmountInput("12,345")).toBe("12.34");
  });

  it("переводит рубли в копейки", () => {
    expect(parseAmountToMinor("1250")).toBe(125000);
    expect(parseAmountToMinor("1250,5")).toBe(125050);
    expect(parseAmountToMinor("0,99")).toBe(99);
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor("0")).toBeNull();
    expect(parseAmountToMinor("1.234")).toBeNull();
  });

  it("форматирует сумму по-русски", () => {
    expect(formatMoney(125000, "RUB")).toBe("1 250 ₽");
    expect(formatMoney(125050, "RUB")).toBe("1 250,50 ₽");
    expect(formatMoney(10000, "USD")).toBe("100 $");
  });
});

const NOW = new Date(2026, 10, 18, 12, 0, 0); // 18 ноября 2026

describe("периоды отчёта", () => {
  it("текущий месяц считается до сегодня", () => {
    const range = periodRange("month", { from: NOW, to: NOW }, NOW);
    expect(range.start.getDate()).toBe(1);
    expect(range.start.getMonth()).toBe(10);
    expect(range.end.getDate()).toBe(18);
    expect(range.days).toBe(18);
  });

  it("прошлый месяц берётся целиком", () => {
    const range = periodRange("prev", { from: NOW, to: NOW }, NOW);
    expect(range.start.getMonth()).toBe(9);
    expect(range.start.getDate()).toBe(1);
    expect(range.end.getDate()).toBe(31);
    expect(range.days).toBe(31);
  });

  it("квартал начинается 1 октября", () => {
    const range = periodRange("quarter", { from: NOW, to: NOW }, NOW);
    expect(range.start.getMonth()).toBe(9);
    expect(range.start.getDate()).toBe(1);
  });

  it("год начинается 1 января", () => {
    const range = periodRange("year", { from: NOW, to: NOW }, NOW);
    expect(range.start.getMonth()).toBe(0);
    expect(range.start.getDate()).toBe(1);
  });

  it("произвольный период включает обе даты", () => {
    const range = periodRange(
      "custom",
      { from: new Date(2026, 9, 1), to: new Date(2026, 9, 15) },
      NOW,
    );
    expect(range.days).toBe(15);
    expect(formatRange(range.start, range.end)).toBe("1–15 октября 2026");
  });

  it("предыдущий период для месяца — прошлый календарный месяц", () => {
    const current = periodRange("month", { from: NOW, to: NOW }, NOW);
    const prev = previousRange("month", current, NOW);
    expect(prev.start.getMonth()).toBe(9);
    expect(prev.end.getMonth()).toBe(9);
    expect(prev.end.getDate()).toBe(31);
  });

  it("предыдущий период для произвольного — такой же длины", () => {
    const current = periodRange(
      "custom",
      { from: new Date(2026, 9, 1), to: new Date(2026, 9, 15) },
      NOW,
    );
    const prev = previousRange("custom", current, NOW);
    const days =
      Math.round(
        (new Date(prev.end).setHours(0, 0, 0, 0) -
          new Date(prev.start).setHours(0, 0, 0, 0)) /
          86_400_000,
      ) + 1;
    expect(prev.end.getTime()).toBeLessThan(current.start.getTime());
    expect(days).toBe(current.days);
  });
});
