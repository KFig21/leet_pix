import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import "./MultiSelect.scss";

export interface Option {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  color?: string;
}

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  // Let the menu break out to (near) full screen width on phones — useful when
  // options carry extra content (e.g. a team's next game). Assumes the trigger
  // sits at the left edge of the content column.
  wideMenu?: boolean;
}

// Dropdown multi-select with full keyboard support:
//   ArrowDown on the trigger opens; Up/Down move between options; Home/End jump;
//   Enter/Space toggle; Esc closes and returns focus; Tab closes and moves on.
export function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  wideMenu,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const optionButtons = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-opt]") ?? [],
    );

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open) optionButtons()[0]?.focus();
  }, [open]);

  const moveFocus = (to: 1 | -1 | "first" | "last") => {
    const btns = optionButtons();
    if (!btns.length) return;
    const cur = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      to === "first"
        ? 0
        : to === "last"
          ? btns.length - 1
          : Math.min(Math.max(cur + to, 0), btns.length - 1);
    btns[next]?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        e.preventDefault();
        moveFocus("first");
        break;
      case "End":
        e.preventDefault();
        moveFocus("last");
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className={`multi-select${open ? " multi-select--open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="multi-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="multi-select__label">{label}</span>
        {selected.length > 0 && (
          <span className="multi-select__count">{selected.length}</span>
        )}
        <ExpandMoreIcon className="multi-select__chevron" />
      </button>

      {open && (
        <div
          className={`multi-select__menu${wideMenu ? " multi-select__menu--wide" : ""}`}
          role="listbox"
          aria-multiselectable="true"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
        >
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <button
                key={o.value}
                data-opt
                type="button"
                role="option"
                aria-selected={checked}
                className={`multi-select__option${checked ? " multi-select__option--on" : ""}`}
                style={
                  checked && o.color
                    ? ({ "--opt-color": o.color } as CSSProperties)
                    : undefined
                }
                onClick={() => onToggle(o.value)}
              >
                <span className="multi-select__check">
                  {checked && <CheckIcon className="multi-select__check-icon" />}
                </span>
                {o.icon && <span className="multi-select__icon">{o.icon}</span>}
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
