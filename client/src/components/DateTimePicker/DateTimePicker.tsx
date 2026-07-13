import { useEffect, useRef, useState } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import "./DateTimePicker.scss";

interface Props {
  // Controlled ISO string ("" when unset).
  value: string;
  onChange: (iso: string) => void;
  // Earliest selectable day (calendar days before it are disabled). Default: today.
  min?: Date;
  placeholder?: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Self-contained date + time picker (calendar popover + native time input) themed
// with the app's own styles — no external date library. Emits a local-time ISO
// string, matching what a native datetime-local would produce.
export function DateTimePicker({ value, onChange, min, placeholder }: Props) {
  const selected = value ? new Date(value) : null;
  const minDay = startOfDay(min ?? new Date());

  const [open, setOpen] = useState(false);
  // Which month the calendar is showing.
  const [view, setView] = useState(() => selected ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);

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

  // Emit a new ISO string, preserving/merging the time-of-day.
  const emit = (next: Date) => {
    // toISOString is UTC; build a local-time string instead so the picked wall
    // clock time is what the author means.
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(
      next.getDate(),
    )}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
    onChange(new Date(local).toISOString());
  };

  const pickDay = (day: number) => {
    const base = selected ?? new Date();
    // Default a fresh selection to a clean upcoming hour so time isn't 00:00.
    const hours = selected ? base.getHours() : Math.min(base.getHours() + 1, 23);
    const minutes = selected ? base.getMinutes() : 0;
    emit(new Date(view.getFullYear(), view.getMonth(), day, hours, minutes));
  };

  const setTime = (hhmm: string) => {
    if (!hhmm) return;
    const [h, m] = hhmm.split(":").map(Number);
    const base = selected ?? new Date(minDay);
    emit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m));
  };

  const y = view.getFullYear();
  const mo = view.getMonth();
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const leading = new Date(y, mo, 1).getDay();
  const monthLabel = view.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  // Don't let the user page to months entirely before the minimum.
  const canGoBack = new Date(y, mo, 1) > new Date(minDay.getFullYear(), minDay.getMonth(), 1);

  const triggerLabel = selected
    ? selected.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : (placeholder ?? "Select date & time");

  const timeValue = selected
    ? `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <div className="dtp" ref={rootRef}>
      <button
        type="button"
        className={`dtp__trigger${selected ? "" : " dtp__trigger--empty"}`}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarMonthIcon className="dtp__trigger-icon" />
        {triggerLabel}
      </button>

      {open && (
        <div className="dtp__pop">
          <div className="dtp__nav">
            <button
              type="button"
              className="dtp__nav-btn"
              disabled={!canGoBack}
              aria-label="Previous month"
              onClick={() => setView(new Date(y, mo - 1, 1))}
            >
              <ChevronLeftIcon />
            </button>
            <span className="dtp__month">{monthLabel}</span>
            <button
              type="button"
              className="dtp__nav-btn"
              aria-label="Next month"
              onClick={() => setView(new Date(y, mo + 1, 1))}
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="dtp__grid">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="dtp__weekday">
                {d}
              </span>
            ))}
            {Array.from({ length: leading }).map((_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(y, mo, day);
              const disabled = date < minDay;
              const isSelected =
                selected &&
                selected.getFullYear() === y &&
                selected.getMonth() === mo &&
                selected.getDate() === day;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  className={`dtp__day${isSelected ? " dtp__day--on" : ""}`}
                  onClick={() => pickDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <label className="dtp__time">
            Time
            <input
              type="time"
              className="dtp__time-input"
              value={timeValue}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
