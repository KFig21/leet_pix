import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import CloseIcon from "@mui/icons-material/Close";
import "./Modal.scss";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Matches the fadeDownOut duration below so the exit animation finishes before
// we actually unmount.
const CLOSE_MS = 400;

// Lightweight centered modal with a backdrop. Animates in, and on close plays
// the exit animation (via a "closing" state) before calling onClose to unmount.
export function Modal({ title, onClose, children }: Props) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // Portaled to <body> so it escapes any clickable/overflow ancestor (e.g. the
  // poll card) and backdrop clicks don't bubble into them.
  // stopPropagation on every handler: React portals bubble events through the
  // React tree (not the DOM), so without this a backdrop click would also reach
  // an ancestor's onClick (e.g. the clickable poll card behind it).
  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    requestClose();
  };

  return createPortal(
    <div
      className={`modal${closing ? " modal--closing" : ""}`}
      onClick={close}
    >
      <div
        className={`modal__panel${closing ? " modal__panel--closing" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={close} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
