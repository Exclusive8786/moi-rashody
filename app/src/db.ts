import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Category, Expense } from "./types";

interface RashodyDB extends DBSchema {
  categories: {
    key: string;
    value: Category;
    indexes: { "by-sortOrder": number };
  };
  expenses: {
    key: string;
    value: Expense;
    indexes: { "by-created": string; "by-category": string };
  };
}

let dbPromise: Promise<IDBPDatabase<RashodyDB>> | null = null;

function getDB(): Promise<IDBPDatabase<RashodyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RashodyDB>("rashody", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("categories")) {
          const store = db.createObjectStore("categories", { keyPath: "id" });
          store.createIndex("by-sortOrder", "sortOrder");
        }
        if (!db.objectStoreNames.contains("expenses")) {
          const store = db.createObjectStore("expenses", { keyPath: "id" });
          store.createIndex("by-created", "createdAt");
          store.createIndex("by-category", "categoryId");
        }
      },
    });
  }
  return dbPromise;
}

export async function readAll(): Promise<{ categories: Category[]; expenses: Expense[] }> {
  const db = await getDB();
  const [categories, expenses] = await Promise.all([
    db.getAll("categories"),
    db.getAll("expenses"),
  ]);
  return { categories, expenses };
}

export async function putCategory(category: Category): Promise<void> {
  const db = await getDB();
  await db.put("categories", category);
}

export async function putCategories(categories: Category[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("categories", "readwrite");
  await Promise.all([
    ...categories.map((c) => tx.store.put(c)),
    tx.done,
  ]);
}

export async function removeCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("categories", id);
}

export async function putExpense(expense: Expense): Promise<void> {
  const db = await getDB();
  await db.put("expenses", expense);
}

export async function removeExpense(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("expenses", id);
}

export async function replaceAll(
  categories: Category[],
  expenses: Expense[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["categories", "expenses"], "readwrite");
  await Promise.all([tx.objectStore("categories").clear(), tx.objectStore("expenses").clear()]);
  await Promise.all([
    ...categories.map((c) => tx.objectStore("categories").put(c)),
    ...expenses.map((e) => tx.objectStore("expenses").put(e)),
    tx.done,
  ]);
}

export async function clearEverything(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["categories", "expenses"], "readwrite");
  await Promise.all([tx.objectStore("categories").clear(), tx.objectStore("expenses").clear()]);
  await tx.done;
}

/** Обнуляет категорию у записей удаляемой статьи, не теряя историю. */
export async function detachExpensesFromCategory(categoryId: string): Promise<string[]> {
  const db = await getDB();
  const affected = await db.getAllFromIndex("expenses", "by-category", categoryId);
  if (affected.length === 0) return [];
  const tx = db.transaction("expenses", "readwrite");
  await Promise.all([
    ...affected.map((e) => tx.store.put({ ...e, categoryId: null })),
    tx.done,
  ]);
  return affected.map((e) => e.id);
}
