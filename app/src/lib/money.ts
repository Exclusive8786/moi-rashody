import type { CurrencyCode } from "../types";

export const CURRENCIES: Record<CurrencyCode, { symbol: string; label: string }> = {
  RUB: { symbol: "₽", label: "Российский рубль" },
  USD: { symbol: "$", label: "Доллар США" },
  EUR: { symbol: "€", label: "Евро" },
  KZT: { symbol: "₸", label: "Казахстанский тенге" },
  UAH: { symbol: "₴", label: "Украинская гривна" },
  BYN: { symbol: "Br", label: "Белорусский рубль" },
};

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCIES[code]?.symbol ?? "₽";
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(code: CurrencyCode, withKopecks: boolean): Intl.NumberFormat {
  const key = `${code}:${withKopecks}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: code,
      minimumFractionDigits: withKopecks ? 2 : 0,
      maximumFractionDigits: withKopecks ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f;
}

/** 125000 → «1 250 ₽», 125050 → «1 250,50 ₽» */
export function formatMoney(minor: number, code: CurrencyCode): string {
  const withKopecks = Math.abs(minor) % 100 !== 0;
  return formatter(code, withKopecks).format(minor / 100).replace(/\u00a0/g, " ");
}

/** Только символ валюты: «₽» */
export function formatSymbol(code: CurrencyCode): string {
  return currencySymbol(code);
}

/**
 * Приводит ввод пользователя к допустимому виду: цифры, один разделитель,
 * не более 9 знаков до и 2 после.
 */
export function sanitizeAmountInput(raw: string): string {
  let value = raw.replace(/[^\d.,]/g, "").replace(/,/g, ".");
  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value =
      value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
  }
  let [intPart, decPart] = value.split(".");
  intPart = (intPart ?? "").replace(/^0+(?=\d)/, "").slice(0, 9);
  if (decPart !== undefined) {
    decPart = decPart.slice(0, 2);
    return `${intPart}.${decPart}`;
  }
  return intPart;
}

/** «1250.5» → 125050 копеек. Возвращает null, если сумма не положительная. */
export function parseAmountToMinor(input: string): number | null {
  const normalized = input.replace(",", ".").trim();
  if (!normalized || !/^\d{0,9}(\.\d{0,2})?$/.test(normalized)) return null;
  const [intPart, decPart = ""] = normalized.split(".");
  const minor =
    Number(intPart || "0") * 100 +
    Number((decPart + "00").slice(0, 2));
  if (!Number.isFinite(minor) || minor <= 0) return null;
  return minor;
}

/** 125050 → «1250.50» для поля ввода */
export function minorToInput(minor: number): string {
  const int = Math.floor(minor / 100);
  const dec = minor % 100;
  return dec === 0 ? String(int) : `${int}.${String(dec).padStart(2, "0")}`;
}

/** Символ валюты для суффикса крупного поля ввода */
export function inputSuffix(code: CurrencyCode): string {
  return currencySymbol(code);
}
