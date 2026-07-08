import "./Toggle.scss";

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  "aria-label"?: string;
}

// Reusable on/off switch.
export function Toggle({ checked, onChange, ...rest }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle${checked ? " toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <span className="toggle__knob" />
    </button>
  );
}
