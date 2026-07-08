import "./Loader.scss";

interface Props {
  size?: number;
  // When true (default), renders centered in a padded block. When false, renders
  // just the spinner inline (e.g. inside a button or a menu row).
  center?: boolean;
}

// App-wide loading spinner (kelly-green ring).
export function Loader({ size = 28, center = true }: Props) {
  const borderWidth = Math.max(2, Math.round(size / 9));
  const spinner = (
    <span
      className="loader__spinner"
      style={{ width: size, height: size, borderWidth }}
      role="status"
      aria-label="Loading"
    />
  );

  return center ? <div className="loader">{spinner}</div> : spinner;
}
