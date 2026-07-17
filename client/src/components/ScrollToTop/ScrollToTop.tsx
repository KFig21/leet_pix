import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Reset the window to the top whenever the route path changes, so navigating to
// a new page never opens it scrolled to wherever the previous page was. Renders
// nothing. Query-string changes (e.g. filters) are ignored — only the path.
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
