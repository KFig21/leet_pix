import { useEffect, useState } from "react";

// Subscribe to a CSS media query from JS (for responsive decisions that can't be
// expressed in CSS alone, e.g. rendering a different component tree).
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// Phones: matches the SCSS `mobile` mixin (< $bp-tablet, 768px).
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
