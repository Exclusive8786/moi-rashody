import type { Category } from "../types";
import { BottomSheet } from "./BottomSheet";
import { CheckIcon, PlusIcon } from "./Icons";

interface CategoryPickerProps {
  open: boolean;
  title?: string;
  categories: Category[];
  selectedId: string | null;
  allowNull?: boolean;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onAddCategory?: () => void;
}

export function CategoryPicker({
  open,
  title = "Статья расхода",
  categories,
  selectedId,
  allowNull,
  onSelect,
  onClose,
  onAddCategory,
}: CategoryPickerProps) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      {categories.length === 0 && !allowNull ? (
        <div className="empty-note">
          <p>Нет статей расхода</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose();
              onAddCategory?.();
            }}
          >
            <PlusIcon size={18} /> Добавить статью
          </button>
        </div>
      ) : (
        <ul className="picker-list">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                className="picker-row"
                onClick={() => {
                  onSelect(category.id);
                  onClose();
                }}
              >
                <span className="dot" style={{ background: category.color }} />
                <span className="picker-name">{category.name}</span>
                {selectedId === category.id && (
                  <CheckIcon size={20} className="picker-check" />
                )}
              </button>
            </li>
          ))}
          {allowNull && (
            <li>
              <button
                type="button"
                className="picker-row"
                onClick={() => {
                  onSelect(null);
                  onClose();
                }}
              >
                <span className="dot dot-muted" />
                <span className="picker-name muted">Без категории</span>
                {selectedId === null && <CheckIcon size={20} className="picker-check" />}
              </button>
            </li>
          )}
        </ul>
      )}
    </BottomSheet>
  );
}
