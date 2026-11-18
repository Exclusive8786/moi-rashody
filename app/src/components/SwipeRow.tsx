import { useRef, useState, type ReactNode } from "react";
import { TrashIcon } from "./Icons";

interface SwipeRowProps {
  children: ReactNode;
  onTap: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}

const ACTION_WIDTH = 88;

export function SwipeRow({ children, onTap, onDelete, deleteLabel = "Удалить" }: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const drag = useRef<{
    x: number;
    y: number;
    axis: "none" | "x" | "y";
    startOffset: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  return (
    <div className="swipe">
      <div className="swipe-actions">
        <button
          type="button"
          className="swipe-delete"
          onClick={() => {
            setOffset(0);
            onDelete();
          }}
          aria-label={deleteLabel}
        >
          <TrashIcon size={22} />
          <span>{deleteLabel}</span>
        </button>
      </div>
      <div
        className="swipe-content"
        style={{
          transform: `translateX(${offset}px)`,
          transition: drag.current ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            axis: "none",
            startOffset: offset,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state) return;
          const dx = event.clientX - state.x;
          const dy = event.clientY - state.y;
          if (state.axis === "none" && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            state.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          }
          if (state.axis === "x") {
            const next = Math.min(0, Math.max(-ACTION_WIDTH, state.startOffset + dx));
            setOffset(next);
            if (Math.abs(next - state.startOffset) > 4) state.moved = true;
          }
        }}
        onPointerUp={() => {
          const state = drag.current;
          drag.current = null;
          if (!state) return;
          if (state.axis === "x") {
            setOffset(offset < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
            if (state.moved) suppressClick.current = true;
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setOffset(0);
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (offset !== 0) {
            setOffset(0);
            return;
          }
          onTap();
        }}
      >
        {children}
      </div>
    </div>
  );
}
