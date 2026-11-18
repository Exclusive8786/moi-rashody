import { useId, useMemo, useRef, useState } from "react";

interface CommentFieldProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  label?: string;
  placeholder?: string;
}

export function CommentField({
  value,
  onChange,
  suggestions,
  label = "Комментарий (необязательно)",
  placeholder = "Например, сигареты",
}: CommentFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    const list = query
      ? suggestions.filter((item) => item.toLowerCase().includes(query))
      : suggestions;
    return list
      .filter((item) => item.toLowerCase() !== query)
      .slice(0, 6);
  }, [suggestions, value]);

  const showList = open && filtered.length > 0;

  return (
    <div className="field comment-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="comment-wrap">
        <input
          id={id}
          className="input comment-input"
          value={value}
          maxLength={40}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {value && (
          <button
            type="button"
            className="comment-clear"
            aria-label="Очистить комментарий"
            onClick={() => {
              onChange("");
              setOpen(true);
            }}
          >
            ×
          </button>
        )}
        {showList && (
          <ul className="comment-suggest" role="listbox" aria-label="Ранее введённые комментарии">
            {filtered.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
